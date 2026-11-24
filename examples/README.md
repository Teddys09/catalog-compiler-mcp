# Catalog Compiler examples

Convert a Shopify or WooCommerce CSV into Google Merchant Center TSV, Meta CSV and TikTok CSV. A single API response includes the generated files and validation issues by SKU. This repository contains public, fictional examples you can inspect before making a request.

| Start here | What you get |
| --- | --- |
| [Shopify CSV to shopping feeds](https://feeds.newbsscraping.com/guides/shopify-product-feed/) | A two-variant export, the exact API request and three generated feeds |
| [Find a missing WooCommerce image](https://feeds.newbsscraping.com/guides/woocommerce-missing-image/) | Broken and corrected exports, the affected SKU and both validation reports |
| [Install the n8n workflow](https://feeds.newbsscraping.com/guides/n8n-product-feeds/) | A manual workflow that validates one CSV batch and returns downloadable files |
| [Open the RapidAPI playground](https://feeds.newbsscraping.com/go/github) | Run a sample with your own RapidAPI key |

## Make one API call

Download or clone this repository. Set the environment variable `RAPIDAPI_KEY` to your own RapidAPI application key after selecting the pay-per-use plan. Run this from the directory containing the example files.

```sh
curl --fail-with-body -sS https://catalog-compiler.p.rapidapi.com/v1/catalog/compile \
  -H "X-RapidAPI-Key: ${RAPIDAPI_KEY:?Set RAPIDAPI_KEY first}" \
  -H 'X-RapidAPI-Host: catalog-compiler.p.rapidapi.com' \
  -H 'Content-Type: application/json' \
  --data-binary @shopify-request.json -o my-response.json
```

Inspect `results[].issues` for the affected SKU, field and suggested fix. Each `results[].feed` contains the channel file as text. The example request includes a fictional eligible TikTok catalog. For your own products, remove TikTok unless your account is eligible. Use URLs you control for product and image pages.

## Automate it with n8n

Use **Import from File** with [catalog-feeds.n8n.json](catalog-feeds.n8n.json), or import the URL from the [workflow guide](https://feeds.newbsscraping.com/guides/n8n-product-feeds/). Configure your key in a Header Auth credential. By default, one manual execution compiles the bundled Shopify CSV for Google and Meta. An eligible catalog can turn on TikTok in the same request. The workflow stops file generation if any selected channel has invalid products.

## Pricing and limits

US $0.01 per API request. Up to 250 variants, 1,000,000 source bytes and three targets per compile. Limit 10 API requests per minute. A rejected request can count. Reading or downloading these static examples makes no paid API call. The caller manages file hosting and any schedule. [Current pricing and bandwidth](https://feeds.newbsscraping.com/go/github-pricing).

These outputs demonstrate feed generation with fictional catalog data. Live merchant acceptance depends on the store and channel. [Support](https://feeds.newbsscraping.com/support).
