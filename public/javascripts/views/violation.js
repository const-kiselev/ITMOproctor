//
// Violation view
//
define([
    "i18n",
    "text!templates/violation.html",
    "collections/attach"
], function(i18n, template, Attach) {
    console.log('views/violation.js');
    var View = Backbone.View.extend({
        className: "violation-view",
        initialize: function(options) {
            var self = this;
            this.listener = _.extend({ name: 'listener'}, Backbone.Events);
            this.faceTrackingState = false;
            this.faceTrackingInited = false;
            this.options = options || {};
            // Violation collection
            var Violations = Backbone.Collection.extend({
                url: 'violation/'+this.options.examId
            });
            this.collection = new Violations();
            this.attach = new Attach(null, {
                onDone: function(model) {
                    self.listener.trigger("done");
                }
            });
            this.currentCanvas = {};
        },
        faceTrackingInit: function(webRtcPeer){
            var self = this;
            if(webRtcPeer === undefined)
                return 'faceTrackingInit Error';
            this.webRtcPeer = webRtcPeer;
            if(this.worker !== undefined){ 
                this.worker.terminate();
                delete this.worker;
            }
            this.worker = new Worker('javascripts/detection-thread.js');
            console.log("worker set");
            
            $(".canvasina").css({width:$('.webcam-output').css("width"),height:$('.webcam-output').css("height"),zIndex:150000,position:"absolute",top:0,left:0})
            var canvas = document.getElementsByClassName('canvasina')[0];
            var context = canvas.getContext('2d');
            
            this.worker.onmessage = function(event){   
                setTimeout( function(){
                    switch(event.data[0]){
                      case 'detectionResult':
                        event.data[2].forEach(function(rect) {                    
                            context.clearRect(0, 0, canvas.width, canvas.height);
                            var pr = false, pr2 = false;
                            if(rect.typeOfArea=='face')
                                {context.strokeStyle = "#68E226"; pr = true;} // green

                            if(rect.facePart == "leftEye")
                                {context.strokeStyle = "#0400e2";pr = true;} // yellow
                            else if(rect.facePart == "rightEye")
                                {context.strokeStyle = "#ff00de"; pr = true;} // yellow
                            else if(rect.facePart == "mouth")
                                {context.strokeStyle = "#DAFF00";pr = true;}
                              context.strokeRect(rect.x, rect.y, rect.width, rect.height);
                        });
                        self.detectionFilter(event.data[1]);
                        if(self.faceTrackingState)
                            self.track();
                        break;
                      case 'inited':
                        self.faceTrackingInited = true;
                        break;
                    }
                }, 1000);
            };
          var ev;
            this.worker.postMessage(['initTrackingAndDetection', 
                                    this.webRtcPeer.currentFrame.width, 
                                    this.webRtcPeer.currentFrame.height]);
          
          return 'inited';
        },
        startTrackingViaWebRtcPeerCurrentFrame: function(){
            if(!this.faceTrackingState)
              return 'Can not start because faceTracking is turned off.';
            return this.track();
        },
        track: function(){
            if(this.webRtcPeer === undefined){ 
                this.stopFaceTracking();
                return 'Can not track: webRtcPeer is undefined';
            }
            else if(this.webRtcPeer.currentFrame === undefined){ 
                this.stopFaceTracking();
                return 'Can not track: webRtcPeer.currentFrame is undefined';
            }
            this.currentCanvas = this.webRtcPeer.currentFrame;
            var context = this.currentCanvas.getContext('2d');
            var imageData = context.getImageData(0, 0, 
                                                 this.currentCanvas.width, 
                                                 this.currentCanvas.height);
            this.worker.postMessage(['trackingAndDetection', 
                                     imageData.data, 
                                     this.currentCanvas.width, 
                                     this.currentCanvas.height]);
            return 'The track process started';
        },
        stopFaceTracking: function(){
            this.faceTrackingInit = false;
            if(this.worker){
                this.worker.terminate();
                delete this.worker;
            }  
        },
        changeFaceTrackingState : function(flag){
            if(typeof(flag) != "boolean")
                return;
            this.faceTrackingState = flag;
        },
        getFaceTrackingState: function(){
            return this.faceTrackingState;
        },
        detectionFilter: function(data){
          console.log("violation.detectionRes",data);
          if(data.indexOf("OUT")>=0)
              this.add(0, "OUT");
//           else if (data.indexOf("FOUND")>=0 && data.indexOf("ONE")<0)
//               this.add(0, "MORE");
          else if(data.filter(i => i === "FOUND").length>=2)
            this.add(0, "MORE");
        },
        add: function(method, data){
            if(!this.faceTrackingState) return;
            var self = this;
            this.attach.reset();
            this.attach.create({
                file: _.dataUrlToFile(this.currentCanvas.toDataURL('image/jpeg', 0.5), 'violation'+Date.now().toString()+'.jpg', 'image/jpeg')
            });
            this.listener.once("done", function(){self.submit(method, data);});
        },
        submit: function(method,data){
          console.log(this.attach, this.attach.toJSON());
            this.collection.create({
                    time: app.now(),
                    data: [data, i18n.t('vision.faceTrackingAnswer.'+data)],
                    method: method,
                    attach: this.attach.toJSON()
            });
        }
    });
    return View;
});