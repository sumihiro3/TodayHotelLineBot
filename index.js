var https = require('https');
var url   = require("url");
var request = require('request');
var GeoCoder = require('./geoCoder');
var HotelSearchEngine = require('./hotelSearchEngine');

// そのまま返すメッセージを作る
function makeReplyMessage(event)
{
    console.log('makeReplyMessage function called!!');
    var messageData = {
        "replyToken" : event.replyToken,
        "messages"   : [ event.message ]
    };
    return messageData;
}

function makeReplyTextMessage(event)
{
    console.log('makeReplyTextMessage function called!!');
    var messageData = {
        'replyToken' : event.replyToken,
        'messages'   : [{
            'text': event.message.text + "に該当する場所が見つかりませんでした",
            'type': 'text'} ]
    };
    return messageData;
}

function makeHotelListCarouselMessage(hotelList, recordCount, condition, event)
{
    console.log('makeHotelListCarouselMessage function called!!');
    var carouselColumns = new Array();
    hotelList.forEach(function(hotel) {
        console.log('Hotel:', hotel);
        
        var totalPrice = [hotel.totalPrice].toString().replace(/(\d)(?=(\d{3})+$)/g , '$1,');
        var columnTitle = (hotel.hotelName == null) ? '（ホテル名無し）': hotel.hotelName.substr(0, 40);
        var columnText = (hotel.planName == null) ? '（プラン名無し）': hotel.planName.substr(0, 60);
        
        var column = {
            thumbnailImageUrl: hotel.thumbnailImageUrl,
            title: columnTitle,
            text: columnText,
            actions: [{
                type: 'uri',
                label: '予約する （' + totalPrice + '円）',
                uri: hotel.reserveUrl
            },
            {
                type: 'uri',
                label: '地図を見る',
                uri: hotel.hotelMapImageUrl
            }]
        };
        
        if (!condition.hotelNo) {
            // 指定したホテルのプランを表示する場合
            var hotelFilterCondition = JSON.parse(JSON.stringify(condition));
            delete hotelFilterCondition['latitude'];
            delete hotelFilterCondition['longitude'];
            hotelFilterCondition.hotelNo = hotel.hotelNo;
            hotelFilterCondition.hotelName = hotel.hotelName;
            hotelFilterCondition.page = 1;
            var hotelFilterButton = makePostbackButton('他のプランを見る', hotelFilterCondition);
            column.actions.push(hotelFilterButton);
        }
        
        carouselColumns.push(column);
    });
    console.log('carouselColumns:', carouselColumns);
    
    var locationName = '位置情報';
    if (condition.address) {
        locationName = condition.address;
    }
    var messageTitle = null;
    if (condition.hotelNo != null) {
        messageTitle = '今日「' + condition.hotelName + '」で宿泊できるプランです';
    } else {
        messageTitle = '今日「' + locationName + '」付近で宿泊できるホテルです';
    }
    
    var messages = [{
                altText: messageTitle,
                type: 'template',
                template: {
                    type: 'carousel',
                    columns: carouselColumns
                }
            }];
    if (recordCount <= 5) {
        messages.unshift({
                type: 'text',
                text: messageTitle
            });
    } else {
        var nextPageCondition = JSON.parse(JSON.stringify(condition));
        var nextPageLabel = 'もっと見る';
        if (recordCount > (condition.page) *5 ) {
            nextPageCondition.page = condition.page +1;
        } else {
            nextPageCondition.page = 1;
            nextPageLabel = 'はじめに戻る';
        }
        
        var buttons = [makePostbackButton(nextPageLabel, nextPageCondition)];
        
        var filterCondition = JSON.parse(JSON.stringify(condition));
        filterCondition.filter = true;
        buttons.push(makePostbackButton('絞り込む', filterCondition));
        
        var messageStr = null;
        if (condition.hotelNo != null) {
            messageStr = '今日「' + condition.hotelName + '」で宿泊できるプランは' + recordCount + '件あります';
        } else {
            messageStr = '今日「' + locationName + '」付近で宿泊できるホテルは' + recordCount + '軒あります';
        }
        
        messages.push({
                altText: messageTitle,
                type: 'template',
                template: {
                    type: 'confirm',
                    text:messageStr,
                    actions: buttons
                }
            }
        );
    }
    
    var messageData = {
        replyToken: event.replyToken,
        messages: messages
    };
    return messageData;
}

function makeNotFoundReplyMessage(condition, event)
{
    console.log('makeNotFoundReplyMessage function called!!');
    var messageTitle = null;
    if (condition.hotelNo) {
        messageTitle = '「' + condition.hotelName + '」では指定の条件に合うプランは見つかりませんでした';
    } else {
        '今日「' + event.message.title + '」付近で宿泊できるホテルは見つかりませんでした';
    }
    var messageData = {
        replyToken : event.replyToken,
        messages   : [{
            text: messageTitle,
            type: "text"} ]
    };
    return messageData;
}

function makeFilterResultMessage(condition, event)
{
    console.log('makeFilterResultMessage function called!!');
    console.log('condition:', condition);
    
    delete condition['filter'];
    condition.page = 1;
    var buttons = [];
    
    // 上限金額, 下限金額
    if (!condition.maxCharge && !condition.minCharge) {
        var maxPriceCondition = JSON.parse(JSON.stringify(condition));
        maxPriceCondition.maxCharge = 10000;
        buttons.push(makePostbackButton('一万円以下', maxPriceCondition));
        
        var minPriceCondition = JSON.parse(JSON.stringify(condition));
        minPriceCondition.minCharge = 10000;
        buttons.push(makePostbackButton('一万円以上', minPriceCondition));
    }
    
    // 禁煙
    if (!condition.squeezeCondition || condition.squeezeCondition.indexOf('kinen') == -1) {
        var kinenCondition = JSON.parse(JSON.stringify(condition));
        if (!kinenCondition.squeezeCondition || kinenCondition.squeezeCondition.length < 1) {
            kinenCondition.squeezeCondition = 'kinen';
        } else {
            kinenCondition.squeezeCondition += ',kinen';
        }
        buttons.push(makePostbackButton('禁煙', kinenCondition));
    }
    
    // 朝食あり
    if (!condition.squeezeCondition || condition.squeezeCondition.indexOf('breakfast') == -1) {
        var breakfastCondition = JSON.parse(JSON.stringify(condition));
        if (!breakfastCondition.squeezeCondition || breakfastCondition.squeezeCondition.length < 1) {
            breakfastCondition.squeezeCondition = 'breakfast';
        } else {
            breakfastCondition.squeezeCondition += ',breakfast';
        }
        buttons.push(makePostbackButton('朝食あり', breakfastCondition));
    }
    
    // 大浴場あり
    if (!condition.squeezeCondition || condition.squeezeCondition.indexOf('daiyoku') == -1) {
        var daiyokuCondition = JSON.parse(JSON.stringify(condition));
        if (!daiyokuCondition.squeezeCondition || daiyokuCondition.squeezeCondition.length < 1) {
            daiyokuCondition.squeezeCondition = 'daiyoku';
        } else {
            daiyokuCondition.squeezeCondition += ',daiyoku';
        }
        buttons.push(makePostbackButton('大浴場あり', daiyokuCondition));
    }
    
    if (buttons.length >= 4) {
        buttons = buttons.slice(0, 4);
    }
    console.log('buttons:', buttons);
    var messageData = null;
    if (buttons.length > 0) {
        messageData = {
            replyToken: event.replyToken,
            messages: [{
                altText: '絞り込み条件',
                type: 'template',
                template: {
                    type: 'buttons',
                    text:'絞り込み条件',
                    actions: buttons
                }
            }]
        };
    }
    return messageData;
}

function makePostbackButton(label, jsonObj)
{
    console.log('makePostbackButton function called!!');
    return {
        type: 'postback',
        label: label,
        data: JSON.stringify(jsonObj)
    };
}


function replyMessage(postData, context)
{
    console.log('replyMessage function called!!');
    console.log('post_data:', postData);
    if (postData == null) {
        return;
    }
    var jsonData = JSON.stringify(postData);
    var parse_url = url.parse('https://api.line.me/v2/bot/message/reply');
    var post_options = {
        host: parse_url.host,
        path: parse_url.path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': `Bearer {${process.env.LINE_CHANNEL_ACCESS_TOKEN}}`,
            'Content-Length': Buffer.byteLength(jsonData)
        }
    };
    // APIリクエスト
    var req = https.request(post_options, function(res){
        res.on('data', function(res) {
            console.log(res.toString());
        }).on('error', function(e) {
            console.log('ERROR: ' + e.stack);
        });
        
        // done
        console.log('parse request done');
        var response = {
            statusCode: 200,
            body: 'Done!!'
        };
        context.succeed(response);
    }).on('error', function(e) {
        console.log(e.message);
    });
    req.write(jsonData);
    req.end();
}

function searchTodayHotelWithCondition(condition, event, context)
{
    console.log('searchTodayHotelWithCondition function called!!');
    if (!condition.page) {
        condition.page = 1;
    }
    
    var hotelSE = new HotelSearchEngine();
    hotelSE.searchTodayHotel(condition, function(hotelList, recordCount, error) {
        var messageData = null;
        if (error || recordCount < 1) {
            messageData = makeNotFoundReplyMessage(condition, event);
        } else {
            messageData = makeHotelListCarouselMessage(hotelList, recordCount, condition, event);
        }
        replyMessage(messageData, context);
    });
}

function handleMessageEvent(event, context)
{
    console.log('handleMessageEvent function called!!');
    
    var messageType = event.message.type;
    console.log('messageType:', messageType);
    if ('location' == messageType) {
            // 位置情報の場合、そのままホテルを検索
            var location = {
                'title': event.message.title,
                'address': event.message.address,
                'latitude': event.message.latitude,
                'longitude': event.message.longitude
            };
            searchTodayHotelWithCondition(location, event, context);
            
        } else if ('text' == messageType) {
            // テキストメッセージの場合、ジオコーディングして位置情報が取れたら、ホテルを検索する
            var geoCoder = new GeoCoder();
            geoCoder.geoCodingFromLocationName(event.message.text, function(location) {
                if (location) {
                    searchTodayHotelWithCondition(location, event, context);
                } else {
                    replyMessage(makeReplyTextMessage(event), context);
                }
            });
        } else {
            // その他のメッセージはそのまま返す
            replyMessage(makeReplyMessage(event), context);
        }
}

exports.handler = (data, context, callback) => {
    console.log('Post data:', data);
    console.log('Post data:', JSON.stringify(data, null, 2));
    var bodyData = JSON.parse(data.body);
    
    for (var i = 0; i < bodyData.events.length; i++) {
        var event = bodyData.events[i];
        console.log('EVENT:', JSON.stringify(event, null, 2));
        var eventType = event.type;
        console.log('eventType:', eventType);
        
        if ('message' == eventType) {
            handleMessageEvent(event, context);
        } else if ('postback' == eventType) {
            console.log('Postback:', JSON.stringify(event.postback, null, 2));
            var condition = JSON.parse(event.postback.data);
            if (!condition.filter) {
                // 検索
                searchTodayHotelWithCondition(condition, event, context);
            } else {
                // 絞り込み検索の検索条件を表示する
                replyMessage(makeFilterResultMessage(condition, event), context);
            }
            
        }
    }
};
