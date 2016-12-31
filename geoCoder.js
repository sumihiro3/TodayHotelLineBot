var request = require('request');

var GeoCoder = function() {
  
}

GeoCoder.prototype.geoCodingFromLocationName = function(locationName, callback) {
    console.log('GeoCoder.geoCodingFromLocationName function called!!');
    console.log('locationName:', locationName);
    
    var geocodeURI = 'http://geo.search.olp.yahooapis.jp/OpenLocalPlatform/V1/geoCoder?output=json';
    geocodeURI += '&appid=' + process.env.YAHOO_API_APPLICATION_ID;
    geocodeURI += '&query=' + encodeURI(locationName.toString('utf8'));
    console.log('GeoCodeURI: '+ geocodeURI);
    
    // call API
    request(geocodeURI, function(error, response, body) {
        var location = null;
        if (error == null && response.statusCode == 200) {
            var  json = JSON.parse(body);
            console.log('GeoCoding result:', json);
            console.log('GeoCoding result Count:' + json.ResultInfo.Count);
            var resultCount = json.ResultInfo.Count;
            if (resultCount > 0) {
                var result = json.Feature[0];
                var latLon = result.Geometry.Coordinates.split(',');
                location = {
                    'title': locationName,
                    'address': result.Name,
                    'latitude': latLon[1],
                    'longitude': latLon[0]
                };
            }
        } else {
            console.log('GeoCoding ERROR!!: ' + error);
        }
        console.log('Location data:', location);
        callback(location);
    });
}

module.exports = GeoCoder;