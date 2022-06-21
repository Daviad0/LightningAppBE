from kivy.app import App
from kivy.uix.button import Button
from kivy.uix.popup import Popup
from kivy.uix.label import Label
from kivy.config import Config
from kivy.uix.gridlayout import GridLayout
from kivy.uix.boxlayout import BoxLayout
from kivy.network.urlrequest import UrlRequest

class Widget(App):
    def build(self):
        
        self.layout = BoxLayout(orientation = "vertical")
        self.button = Button(text = "Daviado")
        self.layout.add_widget(self.button)

        return self.layout

def webReqSuccess(req, res):
    # res = result (content)
    # req = actual request
    # print out result of specific request once done
    print(res)
def webReqFail(req, res):
    print("Failed")
    print(res)

def onButtonPress(self, button):    
    cookies = {'session': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6IkRhdmlhZG8iLCJncm91cCI6InRlc3RpbmctZW52IiwiaWQiOiI2MjdiMjM0NDg5ZTE3ODFhNGM1MjQxMzIiLCJpYXQiOjE2NTMwOTc3NjIsImV4cCI6MTY1MzE4NDE2Mn0.BuFPwXiij3E055fgmFCA3Da1-Gl8PDbukcymeJ9R9d0'}
    headers = {'Content-Type': 'application/json', "group" : "testing-env"}
    UrlRequest("http://localhost:8080/group/items",req_headers=headers, debug=True, on_success = self.webReqSuccess, on_failure = self.webReqFail, on_error=self.webReqFail, timeout=2)
        


if __name__ == '__main__':
    Widget().run()


