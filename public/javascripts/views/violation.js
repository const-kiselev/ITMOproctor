//
// Violation view
//
define([
    "i18n",
    "text!templates/violation.html"
], function(i18n, template) {
    console.log('views/violation.js');
    var View = Backbone.View.extend({
        className: "violation-view",
        initialize: function(options) {
            var self = this;
            this.faceTrackingState = true;
            this.faceTrackingInited = false;
            this.options = options || {};
            // Violation collection
            var Violations = Backbone.Collection.extend({
                url: 'violation/'+this.options.examId
            });
            this.collection = new Violations();
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
            this.worker.onmessage = function(event){
                console.log(event);
                switch(event.data[0]){
                  case 'detectionResult':
                    self.detectionFilter(event.data[1]);
                    if(self.faceTrackingState)
                        self.track();
                    break;
                  case 'inited':
                    self.faceTrackingInited = true;
                    break;
                }
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
            var canvas = this.webRtcPeer.currentFrame;
            var context = canvas.getContext('2d');
            var imageData = context.getImageData(0, 0, 
                                                 canvas.width, 
                                                 canvas.height);
            this.worker.postMessage(['trackingAndDetection', 
                                     imageData.data, 
                                     canvas.width, 
                                     canvas.height]);
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
              self.add(0, "OUT");
          else if (data.indexOf("MORE")>=0 && 
                        detectionRes.indexOf("ONE")<0)
              self.add(0, "MORE");
        },
        add: function(method, data){
            if(!this.faceTrackingOn) return;
            this.collection.create({
                time: app.now(),
                data: data,
                method: method,
                attach: []
            });
        }
    });
    return View;
});