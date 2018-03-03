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
            this.faceTrackingOn = true;
            this.options = options || {};
        },
      changeFaceTracking : function(){
        this.faceTrackingOn = !this.faceTrackingOn;
        if(!this.faceTrackingOn)
            this.stopFaceTracking();
        else
          this.runFaceTracking();
      },
      getFaceTracking: function(){return this.faceTrackingOn;},
      runFaceTracking: function(){
          if(!this.faceTrackingOn){this.stopFaceTracking();}
          else {
                setTimeout(function(){
                    var tracker = new tracking.ObjectTracker(['eye', 'mouth', 'face']); 
                        this.tracker = tracker;
                        tracker.setInitialScale(1);
                        tracker.setStepSize(1.7);
                        tracker.setEdgesDensity(0.199);
                    
                    tracking.track('.webcam-output', tracker, { camera: true });
                    detection.init('.webcam-output');
                    var detectionRes;
                        tracker.on('track', function(event) {
                        detectionRes = detection.findFace(event.data);
                    });
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
       }
    });
    return View;
});