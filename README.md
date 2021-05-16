# Third-Party API for PassItOn

Scrapes pages at [Pass It On](https://www.passiton.org.sg) to get a outstanding 
list of requests and items at end of day, storing each day's list in a KV store 

## Background

[Pass It On](https://www.passiton.org.sg) lists items offered by members of the 
public to donate to the needy, to be picked up by their social workers. It also
allows social workers to post requests for item donations.

This information is only available as a set of pages on the site, and has to be
scraped to make it easily usable by other applications. Motivations to do so 
include:

- Spotting offered items that are unclaimed but can be used to fulfill requests

- Identifying longstanding requests to fulfill using seamless automation

## Architecture

The set-up consists of two components:

- A Cloudflare Worker backed by a Cloudflare Worker KV namespace, holding the
  outstanding offers and requests for each day

- A scraper, created as a Netlify function, periodically triggered by Zapier,
  submitting the day's outstanding offers and requests to Cloudflare

### Cloudflare

The KV stores the list of outstanding item offers and requests for each day.
The key for this store is the date as an ISO-8601 string (YYYY-MM-DD), and each
value for the store is a JSON whose schema is roughly as follows:

```js
{
  requests: [
    {
      id: "99999", // numeric string
      name: "Kind of item",
      description: "More detailed description of what is needed",
      specifications: "A string specifying the item needed" || null,
      contact: {
        org: "Name of organisation",
        name: "Social Worker Name",
        email: "" || null,
        phone: [ "61234567" ], // array of contact numbers as strings
      },
      deliveryCostsCoveredByDonor: false || true,
      date: "01 Jan 1970", // A date string
    },
  ],
  offers: [
    {
      id: "99999", // numeric string
      name: "Kind of item",
      description: "More detailed description of item",
      location: "Comma, Separated, Regions" || null,
      validTill: "01 Jan 1970", // A date string indicating last day of offer
      ageOfYears: 2,
      dimensions: null,
      deliveryCostsCoveredByDonor: false || true,
    },
  ],
  ts: 1621093821471 // time the snapshot was received
}
```

The following endpoints are available at `/api/v1/passiton`:

- `GET /` - returns the offers and requests for items for the previous day, or
  for the specified date, specified as `date` in a query string. Requests and 
  offers can be respectively retrieved through `GET /requests` and `GET /offers`

- `POST /` - accepts a JSON body using the schema above, assuming it to be the
  offers and requests for the day, saving it into the KV store. This expects the 
  following header to be set:

```
Authorization: Bearer <PASSITON_API_KEY>
```

  where `PASSITON_API_KEY` is the secret key held in Cloudflare to authenticate
  requests

### Netlify

A Netlify function, triggered at `/.netlify/functions/scrape-passiton` at a
netlify.app host, will scrape the Pass It On site and submit the results to 
Cloudflare via POST at `/api/v1/passiton`. The Netlify function expects the 
following header to be set:

```
Authorization: Bearer <PASSITON_API_KEY>
```

The function will pass this header through to Cloudflare.

A Zapier Zap is used to trigger the function at 2350H SGT every day.
