from flask import Flask, request
from skpy import Skype
# json
import json
with open('config.json') as config_file:
    config_data = json.load(config_file)

app = Flask(__name__)
@app.route("/send-message", methods=['POST'])
def sendMessage():
    user_data = getGoogleSheetUser();
    data = request.json
    # connect Skype 
    ch = connectSkype()
    # get skype message
    message = getSkypeMessage(user_data,data)
    # check mentioned user exist
    if "<at id=" in message: 
      #send skype message
      ch.sendMsg(message, rich=True)
    return 'Message Sent';

def connectSkype():
    skype_settings = config_data['skype_settings']
    sk = Skype(skype_settings['SKYPE_USERNAME'], skype_settings['SKYPE_PASSWORD'])
    ch = sk.chats[skype_settings['SKYPE_GROUP_ID']]
    return ch

def getSkypeMessage(user_data,data):
    invitationText = ''
    finalMessage = ''
    for user in user_data:
        if(user['GoogleEmail'] == data['email']):
           invitationText = '<at id="{b1}">{b2}</at> '.format(b1=user['SkypeId'], b2=user['Name'].split()[0])
        if data['attendees']:
            for attendee in data['attendees']:
                 if(user['GoogleEmail'] == attendee['email']):
                    invitationText += '<at id="{b1}">{b2}</at> '.format(b1=user['SkypeId'], b2=user['Name'].split()[0])
    finalMessage = '{b1} Coming Events : {b2}'.format(b1=invitationText, b2=data['summary'])
    return finalMessage;

import pandas as pd
from gsheets import Sheets
def getGoogleSheetUser():
    google_settings = config_data['google_settings']
    sheets = Sheets.from_files('client_secrets.json', '~/storage.json')
    url = google_settings['SHEET_URL']
    s = sheets.get(url)
    excel_data = pd.DataFrame(s.sheets[0].values()).to_dict('split')['data']
    label = excel_data[0]
    del excel_data[0]
    userDict = dict()
    userDics = []
    for data in excel_data:
        for index, w in enumerate(data):
            userDict[label[index]] = w
        userDics.append(userDict.copy())
    return userDics;

if __name__ == "__main__":
    app.run(debug=True)