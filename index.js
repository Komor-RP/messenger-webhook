'use strict';

const
    config = require('config'),
    express = require('express'),
    request = require('request'),
    body_parser = require('body-parser'),
    app = express().use(body_parser.json()); // creates express http server

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));


// Arbitrary value used to validate a webhook
const VERIFY_TOKEN = "myToken";

// Generate a page access token for your page from the App Dashboard
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// URL where the app is running (include protocol). Used to point to scripts and
// assets located at this address.
const SERVER_URL = 'https://messenger-app-fb.herokuapp.com/webhook';



/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function (req, res) {
    if (req.query['hub.mode'] === 'subscribe' &&
        req.query['hub.verify_token'] === VERIFY_TOKEN) {
        console.log("Validating webhook");
        res.status(200).send(req.query['hub.challenge']);
    } else {
        console.error("Failed validation. Make sure the validation tokens match.");
        res.sendStatus(403);
    }
});


app.post('/webhook', function (req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object == 'page') {
        // Iterate over each entry
        // There may be multiple if batched
        data.entry.forEach(function (pageEntry) {
            // Iterate over each messaging event
            if (pageEntry.messaging) {
              pageEntry.messaging.forEach(function (messagingEvent) {
                  if (messagingEvent) {

                    if (messagingEvent.message) {
                      if (messagingEvent.message.is_echo) {
                        console.log("echo");
                      } else {
                          receivedMessage(messagingEvent);
                      }
                    } else if (messagingEvent.postback) {
                        receivedPostback(messagingEvent);
                    } else {
                        console.log("Webhook received unknown messagingEvent: ", messagingEvent);
                    }
                  }

              });
            }
        });

        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know you've
        // successfully received the callback. Otherwise, the request will time out.
        res.sendStatus(200);
    }
});


function receivedMessage(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var message = event.message;

    console.log("Received message for user %d and page %d at %d with message:",
        senderID, recipientID, timeOfMessage);
    console.log(JSON.stringify(message));

    var messageText = message.text;

}

/*
 * Postback Event Handling
 */
function receivedPostback(event) {
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfPostback = event.timestamp;
    var payload = event.postback.payload;
    console.log("switch: " + payload);

    console.log("Received postback for user %d and page %d with payload '%s' " +
        "at %d", senderID, recipientID, payload, timeOfPostback);

    switch (payload) {
        case 'get_started':
            sendGetStarted(senderID);
            break;
        case 'social_media':
            sendTextMessage(senderID, "social_media");
            break;
        case 'coaching':
            sendTextMessage(senderID, "coaching");
            break;
        case 'website':
            sendTextMessage(senderID, "website");
            break;
        default:
            console.log("invalid switch: " + payload);
    }
}

/*
 * Send a text message using the Send API.
 */
function sendTextMessage(recipientId, postback) {
    let messageText;
    let socialMediaResponse = "Great! Can you give us more details about the help you need with social media?";
    let coachingResponse = "Great! What kind of training services do you require?";
    let websiteResponse = "Great! Tell us more about your website needs!";


    if (postback === "social_media") {
      messageText = socialMediaResponse;
    } else if (postback === "coaching") {
      messageText = coachingResponse;
    } else if (postback === "website") {
      messageText = websiteResponse;
    } else {
      messageText = "";
    }

    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: messageText
        }
    };

    callSendAPI(messageData);
}

/*
 * Handles get started button response
 */
function sendGetStarted(recipientId) {
  request({
    url: `${'https://graph.facebook.com/v2.6/'}${recipientId}`,
    qs: {
      access_token: process.env.PAGE_ACCESS_TOKEN,
      fields: "first_name"
    },
    method: "GET"
  }, function(error, response, body) {
    var greeting = "";
    if (error) {
      console.log("Error getting user's name: " +  error);
    } else {
      var bodyObj = JSON.parse(body);
      const name = bodyObj.first_name;
      console.log("name: " + name);
      greeting = "Hi " + name + "! 👋 ";
    }
    const message = greeting + "Thank you for contacting Activate Biz! \nWhat is it that you would like help with?";

    /*
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            attachment: {
                type: "template",
                payload: {
                    template_type: "button",
                    text: message,
                    buttons: [{
                        type: "postback",
                        title: "Social Media Marketing",
                        payload: "social_media"
                    }, {
                        type: "postback",
                        title: "Coaching & Training",
                        payload: "coaching"
                    }, {
                        type: "postback",
                        title: "Website",
                        payload: "website"
                    }]
                }
            }
        }
    };
    */
    /*messagedata quick reply alternative*/
    var messageData = {
        recipient: {
            id: recipientId
        },
        message: {
            text: "Here is a quick reply!",
            quick_replies: [
              {
                content_type: "text",
                title: "Social Media",
                payload: "social_media"
              },
              {
                content_type: "text",
                title: "Website",
                payload: "social_media"
              }
            ]
        }
    };

    callSendAPI(messageData);
  });

}


/*
 * Call the Send API. The message data goes in the body. If successful, we'll
 * get the message id in a response
 *
 */
function callSendAPI(messageData) {
    console.log(messageData);
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token: PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: messageData

    }, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var recipientId = body.recipient_id;
            var messageId = body.message_id;

            if (messageId) {
                console.log("Successfully sent message with id %s to recipient %s",
                    messageId, recipientId);
            } else {
                console.log("Successfully called Send API for recipient %s",
                    recipientId);
            }
        } else {
            console.error("Failed calling Send API", response.statusCode, response.statusMessage, body.error);
        }
    });
}
