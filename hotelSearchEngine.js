var https = require("https");
var url   = require("url");
var rakuten = require('rakuten');
var hotel = rakuten.travel.hotelvacant('2013-10-24');

var HotelSearchEngine = function() {
  
}

function parseHotelSearchApiResponse(apiRes)
{
    console.log('HotelSearchEngine.parseHotelSearchApiResponse function called!!');
    console.log('apiRes:', apiRes);
    var hotelList = new Array();
    for (var i = 0; i < apiRes.hotels.length; i++)  {
        var hotel = apiRes.hotels[i].hotel[0];
        var basicInfo = apiRes.hotels[i].hotel[0].hotelBasicInfo;
        var reserveInfo = apiRes.hotels[i].hotel[2].hotelReserveInfo;
        var roomInfo = apiRes.hotels[i].hotel[3].roomInfo[0].roomBasicInfo;
        var roomCharge = apiRes.hotels[i].hotel[3].roomInfo[1].dailyCharge;
        var rank = i + 1;
        
        var originalThumbUrl = basicInfo.hotelThumbnailUrl;
        var regExp = new RegExp('http:', 'g');
        var newThumnbUrl = originalThumbUrl.replace(regExp, 'https:');
        var totalPrice = [roomCharge.total].toString().replace(/(\d)(?=(\d{3})+$)/g , '$1,');
        
        var hotelInfo = {
            'index': i,
            'hotelNo': basicInfo.hotelNo,
            'hotelName': basicInfo.hotelName,
            'planName': roomInfo.planName,
            'thumbnailImageUrl': newThumnbUrl,
            'totalPrice': roomCharge.total,
            'reserveUrl': roomInfo.reserveUrl,
            'hotelMapImageUrl': basicInfo.hotelMapImageUrl
        };
        hotelList.push(hotelInfo);
    }
    return hotelList;
}

HotelSearchEngine.prototype.searchTodayHotel = function(condition, callback) {
    console.log('HotelSearchEngine.searchTodayHotelFromLocation function called!!');
    console.log('condition:', condition);
    
    // 検索条件
    var searchParams = {
        applicationId: process.env.RAKUTEN_APPLICATION_ID,
        affiliateId: process.env.RAKUTEN_APPLICATION_AFFILIATE_ID,
        datumType: 1,
        hits: 5,
        page: condition.page,
        hotelThumbnailSize: 3,
        
//        sort: '+roomCharge',
        responseType: 'middle'
    }
    if (condition.hotelNo) {
        searchParams.hotelNo = condition.hotelNo;
        searchParams.searchPattern = 1;
    } else {
        searchParams.latitude = condition.latitude;
        searchParams.longitude = condition.longitude;
        searchParams.searchPattern = 0;
    }
    if (condition.maxCharge) {
        searchParams.maxCharge = condition.maxCharge;
    }
    if (condition.minCharge) {
        searchParams.minCharge = condition.minCharge;
    }
    if (condition.squeezeCondition) {
        searchParams.squeezeCondition = condition.squeezeCondition;
    }
    
    
    // 楽天APIで検索実行
    hotel.search(searchParams, function(err, res) {
        var hotelList = null;
        var recordCount = 0;
        if (err) {
            console.log('Hotel search error!: ', err.message);
        } else {
            hotelList = parseHotelSearchApiResponse(res);
            recordCount = res.pagingInfo.recordCount;
        }
        console.log('Hotel List: ', hotelList);
        callback(hotelList, recordCount, err);
    });
}

module.exports = HotelSearchEngine;