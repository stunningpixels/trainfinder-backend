var express = require('express');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');
var axios = require('axios');
var app     = express();
var moment = require("moment");

var cache = {}

app.get('/scrape', function(req, res){

  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");

  let lookAhead = req.query.lookAhead || 7;
  let originCode = req.query.originCode || null;
  let destinationCode = req.query.destinationCode || null;

  if(cache[originCode + '_' + destinationCode + '_' + lookAhead + '_' + moment().format("DD/MM/YYYY")]) {
    res.send(cache[originCode + '_' + destinationCode + '_' + lookAhead + '_' + moment().format("DD/MM/YYYY")]);
    return;
  }

  let requests = [];
  for (i = 0; i <= lookAhead; i++) {
    let dateString = moment().add(i, 'days').format("DD/MM/YYYY");
    requests.push(getDetails(originCode, destinationCode, dateString));
  }

  axios.all(requests)
    .then(function(results) {
      let combinedResults = [];
      results.map(function(response, index) {
        combinedResults.push(response);
      });
      cache[originCode + '_' + destinationCode + '_' + lookAhead + '_' + moment().format("DD/MM/YYYY")] = combinedResults;
      res.send(combinedResults);
    });


})

function extractDetailsFromResult(extract) {
  let journeys = [];
  extract.children().each(function(index) {
    if(cheerio(this).attr('scdata-price')) {
      let journey = {};
      journey.price = parseFloat(cheerio(this).attr('scdata-price'));
      let journeyStringParts = cheerio(this).find(".two").first().children().html().split("\n");
      journey.departs = journeyStringParts[2].replace(/\s/g,'');
      journeyStringParts = cheerio(this).find(".two").first().children().next().html().split("\n");
      journey.arrives = journeyStringParts[2].replace(/\s/g,'');
      journeys.push(journey);
    }
  });

  let cheapest = null
  if(journeys.length >= 1) {
    cheapest = journeys[0].price
    journeys.map(function(item, index) {
      if(cheapest > item.price) {
        cheapest = item.price
      }
    })
  }
  return {cheapest, journeys};
  //return cheapest;
}


function getDetails(originCode, destinationCode, date) {
  return axios.get("https://uk.megabus.com/JourneyResults.aspx?originCode=" + originCode + "&destinationCode=" + destinationCode + "&outboundDepartureDate=" + encodeURI(date) + "&inboundDepartureDate=" + encodeURI(date) + "&passengerCount=1&transportType=-1&concessionCount=0&nusCount=0&outboundWheelchairSeated=0&outboundOtherDisabilityCount=0&inboundWheelchairSeated=0&inboundOtherDisabilityCount=0&outboundPcaCount=0&inboundPcaCount=0&promotionCode=&withReturn=1")
    .then(function(response) {
      var prices = [];
      const $ = cheerio.load(response.data);

      return {
        date,
        outbound: extractDetailsFromResult($("#JourneyResylts_OutboundList_main_div")),
        inbound: extractDetailsFromResult($("#JourneyResylts_InboundList_main_div"))
      }
    })
    .catch(function(error) {
      console.log(error);
    });
}


app.set('port', (process.env.PORT || 5000));


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});
exports = module.exports = app;
