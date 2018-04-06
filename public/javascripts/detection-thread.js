var _global = {};
var window = {};
var tracking = {};
var detection = {};
 _global.tracking = tracking;
importScripts('../bower_components/tracking.js/build/tracking.js',
							'../bower_components/tracking.js/build/data/eye-min.js', 
							'../bower_components/tracking.js/build/data/face-min.js',
						 	'../bower_components/tracking.js/build/data/mouth-min.js',
							'detection.js'
						 	);
(function(_global, undefined){
	
  tracking.ObjectTracker.prototype.track = function(pixels, width, height) {
    var self = this;
    var classifiers = this.getClassifiers();

    if (!classifiers) {
      throw new Error('Object classifier not specified, try `new tracking.ObjectTracker("face")`.');
    }
    var tmpRes;
		var results = [];
    var i = 1;
    var typeOfArea;
    classifiers.forEach(function(classifier) {
      if(classifier[3]==6)
        typeOfArea = "eye";
      else if(classifier[3]==13)
        typeOfArea = "mouth";
      else if(classifier[3]==3)
        typeOfArea = "face";
      tmpRes = tracking.ViolaJones.detect(pixels, width, height, self.getInitialScale(), self.getScaleFactor(), self.getStepSize(), self.getEdgesDensity(), classifier);
      tmpRes.forEach(function(tmpResData){
        tmpResData.typeOfArea = typeOfArea;
      });
      results = results.concat(tmpRes);
			
    });
		return results;
  };
}(_global));
onmessage = function(event){
	var cmd = '';
		if(event.data[0] !==undefined)
				cmd = event.data[0];
		switch(cmd){
			case 'initTrackingAndDetection':
				_global.tracker = new tracking.ObjectTracker(['eye', 'mouth', 'face']);
// 				_global.tracker.setInitialScale(1);
// 				_global.tracker.setStepSize(1.7);
// 				_global.tracker.setEdgesDensity(0.199);
				detection.init(event.data[1], event.data[2]);
				postMessage(['inited']);
				break;
			case 'trackingAndDetection':
				var trackingRes = _global.tracker.track(event.data[1], event.data[2], event.data[3]);
				if(trackingRes !== undefined){
					var detectionRes = detection.findFace(trackingRes);
					console.log(detectionRes);
					console.log(trackingRes);
					postMessage(['detectionResult', detectionRes, trackingRes]);
					break;
				}
					postMessage(['empty']);
				break;
		}
};