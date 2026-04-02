// server/src/config/qstashClient.js
import 'dotenv/config';
import { Client } from "@upstash/qstash"

const qstash = new Client({
  baseUrl: process.env.QSTASH_URL,
  token: process.env.QSTASH_TOKEN,
})

export default qstash;
