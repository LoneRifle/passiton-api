const got = require('got')
const cheerio = require('cheerio')

const PASSITON_HOST = 'https://www.passiton.org.sg'
const REQUESTS_URL = `${PASSITON_HOST}/grant-a-wish`
const OFFERS_URL = `${PASSITON_HOST}/item-list`

function extractPageCount(html) {
  const $ = cheerio.load(html)
  const pageCount = $(
    'div[class^=iveo_pipe_passiton_list_] > form#f td[align=right] a:last-child'
  ).text()
  return pageCount
}

function childrenArray(children) {
  return new Array(children.length).fill(0)
    .map((_v, i) => children.eq(i))
}

async function extractAllItems(url, rowMapper = r => r) {
  const response = await got(url)
  const pageCount = extractPageCount(response.body)
  // generate the urls of pages to be fetched, typically
  // pages 2 to `pageCount`
  const pageUrls = new Array(pageCount - 1).fill(0)
    .map((_v, i) => `${url}?pg=${i + 2}`)
  const pagePromises = [
    Promise.resolve(response.body),
    ...pageUrls.map(url => got(url).then((response) => response.body))
  ].map((bodyPromise) => bodyPromise.then((body) => {
    const $ = cheerio.load(body)
    const children = $('div[class^=iveo_pipe_passiton_list_] > table[class^=tbl_form] tr[class^=line]')
    return childrenArray(children)
      .map(row => childrenArray(row.children()))
      .map(rowMapper)
  }))
  return Promise.all(pagePromises)
}

function mapContactDetails(details) {
  const isEmail = s => s.includes('@') && s.includes('.')
  const email = details.find(isEmail) || null
  const phone = details.filter(s => !isEmail(s))
  return { email, phone }
}

function mapRequest([idCell, detailsCell, contactCell]) {
  const nameCell = detailsCell.find('span[id^=span_name]')
  const descriptionCell = detailsCell.find('div.item_desc')

  const id = idCell.text().trim()
  const name = nameCell.text().trim()
  const description = (descriptionCell.text() || '').trim()

  detailsCell.children()
    .remove('span')
    .remove('div.item_desc')

  const specifications = detailsCell.text().trim() || null

  const deliveryCostsCoveredByDonor = contactCell.find('img').length > 0
  contactCell.children().remove('div')
  const contactText = contactCell.html().split('<br>').map(s => s.trim()).filter(Boolean)
  const [org, contactName, ...details] = contactText

  const date = details.pop()

  const contact = {
    org, name: contactName,
    ...mapContactDetails(details)
  }

  return { id, name, description, specifications, contact, deliveryCostsCoveredByDonor, date }
}

function mapOffer([idCell, detailsCell, locationCell, _pictureCell, specificationsCell]) {
  const id = idCell.text().trim()
  const name = detailsCell.find('b').text().trim()
  const description = detailsCell.find('div[id^=desc_]').text().trim()
  const location = locationCell.find('b').text() || null
  const deliveryCostsCoveredByDonor = locationCell.find('img').length > 0

  const [validTillText, ageText, dimensionsText] = specificationsCell.html().split('<br>').map(s => s.trim()).filter(Boolean)

  const validTill = validTillText.replace('valid til ', '')
  const ageInYears = Number(ageText.split(' ')[0])
  const dimensions = dimensionsText === '-' ? null : dimensionsText

  return { id, name, description, location, validTill, ageInYears, dimensions, deliveryCostsCoveredByDonor }
}

exports.handler = async function ({ headers: requestHeaders }) {
  const requestsPromise = extractAllItems(REQUESTS_URL, mapRequest)
  const offersPromise = extractAllItems(OFFERS_URL, mapOffer)
  const json = await Promise.all([requestsPromise, offersPromise])
    .then(([requests, offers]) => ({
      requests: [].concat(...requests),
      offers: [].concat(...offers),
      ts: Date.now(),
    }))
  if (process.env.PASSITON_KV_URL) {
    const headers = {
      Authorization: requestHeaders.Authorization || requestHeaders.authorization,
    }
    await got.post(process.env.PASSITON_KV_URL, { json, headers })
  }
  return { statusCode: 200, body: JSON.stringify(json) }
}