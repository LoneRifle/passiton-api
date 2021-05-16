import { Router } from 'itty-router'

const API_V1_PATH = '/api/v1'

const passItOn = Router({ base: `${API_V1_PATH}/passiton` })

async function passItOnLookup(dateStr) {
  const [ parsedDateStr ] = new Date(dateStr).toISOString().split('T')
  return PASSITON.get(parsedDateStr, { type: 'json' })
}

passItOn.get('/', async (request) => {
  const dateStr = (request.query || {}).date || Date.now() - (24 * 3600 * 1000)
  const result = await passItOnLookup(dateStr)
  return new Response(JSON.stringify(result), {
    status: result ? 200 : 404,
    headers: { 'Content-Type': 'application/json' },
  })
})

passItOn.get('/offers', async (request)  => {
  const dateStr = (request.query || {}).date || Date.now() - (24 * 3600 * 1000)
  const { offers } = (await passItOnLookup(dateStr)) || {}

  return new Response(JSON.stringify(offers), {
    status: offers ? 200 : 404,
    headers: { 'Content-Type': 'application/json' },
  })
})

passItOn.get('/requests', async (request)  => {
  const dateStr = (request.query || {}).date || Date.now() - (24 * 3600 * 1000)
  const { requests } = (await passItOnLookup(dateStr)) || {}

  return new Response(JSON.stringify(requests), {
    status: requests ? 200 : 404,
    headers: { 'Content-Type': 'application/json' },
  })
})

/*
This shows a different HTTP method, a POST.

Try send a POST request using curl or another tool.

Try the below curl command to send JSON:

$ curl -X POST <worker> -H "Content-Type: application/json" -d '{"abc": "def"}'
*/
passItOn.post('/', async (request) => {
  const token = (request.headers.get('Authorization') || '').replace('Bearer ', '')
  if (token !== PASSITON_API_KEY) {
    return new Response(
      JSON.stringify({ status: 401, message: 'Unauthorized' }),
      { 'Content-Type': 'application/json', status: 401 },
    )
  }

  const payload = await request.json()

  const [ parsedDateStr ] = new Date().toISOString().split('T')
  const data = JSON.stringify(payload, null, 2)

  await PASSITON.put(parsedDateStr, data)
  return new Response(data, {
    headers: {
      'Content-Type': 'application/json',
    },
  })
})

const notFoundHandler = () => new Response(
  JSON.stringify({ status: 404, message: 'Not Found' }),
  { 'Content-Type': 'application/json', status: 404 },
)

passItOn.all('*', notFoundHandler)

const router = Router({ base: API_V1_PATH })

router.all('/passiton/*', passItOn.handle).all('*', notFoundHandler)

addEventListener('fetch', e => {
  e.respondWith(router.handle(e.request))
})
