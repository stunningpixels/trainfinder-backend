const express = require('express');
const axios = require('axios');
const app = express();
const moment = require("moment");

let cache = {}

const queryMega = ({originCode, destinationCode, departureDate}) => axios.get(`https://uk.megabus.com/journey-planner/api/journeys?originId=${originCode}&destinationId=${destinationCode}&departureDate=${departureDate}&totalPassengers=1&concessionCount=0&nusCount=0&days=1`)

const cacheRef = ({originCode, destinationCode}) => `${originCode}_${destinationCode}_${moment(new Date()).format('YYYY-MM-DD')}`

app.get('/scrape', async (req, res) => {
  // Set CORS headers
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  // Request defaults
  let lookAhead = req.query.lookAhead || 7;
  let originCode = req.query.originCode || null;
  let destinationCode = req.query.destinationCode || null;

  // Generate the cache reference string
  const cacheRefString = cacheRef({originCode, destinationCode})

  // Check if a cache result exists for this request
  if (cache[cacheRefString]) {
    return res.send(cache[cacheRefString]);
  }

  // Array to store mutliple days of results for a given request
  const results = []

  for (i = 0; i <= lookAhead; i++) {

    // Current date to check
    const momentDate = moment().add(i, 'days')
    const departureDate = momentDate.format("YYYY-MM-DD");

    // Options to pass to Mega
    const outboundOptions = {
      originCode,
      destinationCode,
      departureDate
    }

    const inboundOptions = {
      originCode: destinationCode,
      destinationCode: originCode,
      departureDate
    }

    // The API requests
    const outboundResults = await queryMega(outboundOptions).then(({data}) => data.journeys)
    const inboundResults = await queryMega(inboundOptions).then(({data}) => data.journeys)

    // Store the cheapest fares of the day
    let cheapestOutbound = null;
    let cheapestInbound = null;

    // Push this day's results to the multiple days array
    const formattedOutboundResults =
      outboundResults
        .filter(({legs}) => legs.some(({transportTypeId}) => transportTypeId === 2))
        .map(({departureDateTime, arrivalDateTime, price}) => {
          if (!cheapestOutbound || cheapestOutbound > price) {
            cheapestOutbound = price
          }

          return {
            price,
            departs: moment(departureDateTime).format('HH:mma'),
            arrives: moment(arrivalDateTime).format('HH:mma')
          }
        })

    const formattedInboundResults =
      inboundResults
        .filter(({legs}) => legs.some(({transportTypeId}) => transportTypeId === 2))
        .map(({departureDateTime, arrivalDateTime, price}) => {
          if (!cheapestInbound || cheapestInbound > price) {
            cheapestInbound = price
          }

          return {
            price,
            departs: moment(departureDateTime).format('HH:mma'),
            arrives: moment(arrivalDateTime).format('HH:mma')
          }
        })

    results.push({
      date: momentDate.format('DD/MM/YYYY'),
      outbound: {
        cheapest: cheapestOutbound,
        journeys: formattedOutboundResults
      },
      inbound: {
        cheapest: cheapestInbound,
        journeys: formattedInboundResults
      }
    })
  }

  // Store the result in cache for 1 day
  cache[cacheRefString] = results

  return res.send(results);
  //
  // axios.all(requests)
  //   .then(function(results) {
  //     let combinedResults = [];
  //     results.map(function(response, index) {
  //       if(response.outbound.cheapest === null && response.inbound.cheapest === null) {
  //       }else {
  //         combinedResults.push(response);
  //       }
  //     });
  //     cache[originCode + '_' + destinationCode + '_' + lookAhead + '_' + moment().format("DD/MM/YYYY")] = combinedResults;
  //     res.send(combinedResults);
  //   });


})

// function extractDetailsFromResult(extract) {
//   let journeys = [];
//   extract.children().each(function(index) {
//     if(cheerio(this).attr('scdata-price')) {
//       let journey = {};
//       journey.price = parseFloat(cheerio(this).attr('scdata-price'));
//       let journeyStringParts = cheerio(this).find(".two").first().children().html().split("\n");
//       journey.departs = journeyStringParts[2].replace(/\s/g,'');
//       journeyStringParts = cheerio(this).find(".two").first().children().next().html().split("\n");
//       journey.arrives = journeyStringParts[2].replace(/\s/g,'');
//       journeys.push(journey);
//     }
//   });
//
//   let cheapest = null
//   if(journeys.length >= 1) {
//     cheapest = journeys[0].price
//     journeys.map(function(item, index) {
//       if(cheapest > item.price) {
//         cheapest = item.price
//       }
//     })
//   }
//   return {cheapest, journeys};
//   //return cheapest;
// }

app.set('port', (process.env.PORT || 5000));


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

exports = module.exports = app;
