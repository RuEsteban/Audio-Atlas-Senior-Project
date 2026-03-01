# Audio-Atlas-Senior-Project

Repo for Audio Atlas Senior Project Spring 2026

# Public Website:

https://audio-atlas-senior-project.vercel.app/

# Run locally

npm run dev

# Backend Test Procedures
## Mock API Testing
From ...\server> **npm test**

## Live API testing
From ...\server> **$env:RUN_LIVE_TESTS="1"**  //enable live testing
     ...\server> **npm test**
     ...\server> **Remove-Item Env:RUN_LIVE_TESTS**  //disable live testing

## Source API and DB deposit testing ##
### Demonstrate Supabase upsert ###
From ...\server> **npm start**
     ...\server> *Invoke-RestMethod -Method Post `
                    -Uri http://localhost:4000/ingest/lastfm/country-top-tracks `
                    -ContentType "application/json" `
                    -Body '{"country":"US","limit":10}'*    // do this in separate terminal as one single entry

### Demonstrate information retrieval from Spotify ###
From ...\server> *Invoke-WebRequest -UseBasicParsing `
                    "http://localhost:4000/demo1/enrich?track=Blinding%20Lights&artist=The%20Weeknd"*

*Control-C to end npm start in console*
