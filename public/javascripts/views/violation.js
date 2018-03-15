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
            this.faceTrackingOn = true;
            this.options = options || {};
            // Violation collection
            var Violations = Backbone.Collection.extend({
                url: 'violation/'+this.options.examId
            });
            this.collection = new Violations();
            this.tracker = new tracking.ObjectTracker(['eye', 'mouth', 'face']); 
        },
        changeFaceTracking : function(){
          this.faceTrackingOn = !this.faceTrackingOn;
          if(!this.faceTrackingOn)
              this.stopFaceTracking();
          else
            this.runFaceTracking();
        },
        getFaceTracking: function(){return this.faceTrackingOn;},
        startFaceTracking: function(element){
            detection.init(element);
        },
        faceTracking: function(canvas){
            var self = this;
          tracking.track(canvas, this.tracker);
            this.tracker.on('track', function(event) {
                if (event.data.length !== 0) {
                    console.log(event);
                    //self.detectionAction(event);
                } 
            });
            
        },
        detectionAction: function(event){
              var detectionRes = detection.findFace(event.data);
              console.log("detectionRes",detectionRes);
              if(detectionRes.indexOf("OUT")>=0)
                  self.add(0, "OUT");
              else if (detectionRes.indexOf("MORE")>=0 && 
                            detectionRes.indexOf("ONE")<0)
                  self.add(0, "MORE");
            },
        runFaceTracking: function(){
            var self = this;
            if(!this.faceTrackingOn){this.stopFaceTracking();}
            else {
                  setTimeout(function(){
                      //var myWorker = new Worker("detection.js");
                      var tracker = new tracking.ObjectTracker(['eye', 'mouth', 'face']); 
                          this.tracker = tracker;
                          tracker.setInitialScale(1);
                          tracker.setStepSize(1.7);
                          tracker.setEdgesDensity(0.199);

                      tracking.track('.webcam-output', tracker, { camera: true });
                      detection.init('.webcam-output');
                      tracker.on('track', function(event) {this.detectionAction(event);});
                  },5000);  
                }
        },
        stopFaceTracking: function(){
             console.log("stopFaceTracking");
             this.tracker.removeAllListeners();
             if(this.tracker){ 
                console.log("stopFaceTracking");
                this.tracker.removeAllListeners();
             }     
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