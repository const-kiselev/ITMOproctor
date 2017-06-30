var config = require('nconf').file('../config.json');
var mongoose = require('mongoose');
var config = require('nconf');
var path = require('path');
var moment = require('moment');

if (process.argv.length !== 3) {
    process.exit(1);
}

mongoose.connect(config.get('mongoose:uri'));
var conn = mongoose.connection;
conn.on('error', function(err) {
    console.error("MongoDB connection error:", err.message);
});
conn.once('open', function() {
    console.info("MongoDB is connected.");
    var data = require(path.join(__dirname, process.argv[2]));
    db.go(data, function() {
        mongoose.disconnect();
        console.log('done');
        process.exit(0);
    });
});

var db = {
    nextExam: function(callback) {
        if (!this.examIterator) this.examIterator = 0;
        if (arguments.length === 0) this.examIterator++;
        else {
            this.examIterator--;
            if (this.examIterator <= 0) {
                callback();
            }
        }
        process.stdout.write(".");
    },
    save: function(obj, callback) {
        obj.save(function(err, data) {
            if (err) console.log(err);
            if (callback) callback();
        });
    },
    go: function(data, callback) {
        var self = this;
        var User = require('./models/user');
        var Exam = require('./models/exam');
        var copyObj = function(obj) {
            return JSON.parse(JSON.stringify(obj));
        };
        var addExams = function(userId, exams, callback) {
            self.examIterator = undefined;
            exams.forEach(function(examItem){
                examItem.student = userId;
                var exam = new Exam(examItem);
                self.nextExam();
                self.save(exam, function() {
                    self.nextExam(callback);
                });
            });
        }; 
        
        data.forEach(function(userItem, index) {
            var exams = copyObj(userItem.exams);
            delete userItem.exams;
            User.findOne({
                username: userItem.username
            }).exec(function(err, userData) {
                if (err) return;
                if (!userData) {
                    var user = new User(userItem);
                    user.save(function(err){
                        addExams(user._id,exams,function(){
                            if (index == data.length-1) {
                                process.stdout.write("\n");
                                callback();
                            }
                        });
                    });
                }
                else {
                    return addExams(userData._id,exams,function(){
                                if (index == data.length-1) {
                                    process.stdout.write("\n");
                                    callback();
                                }
                            });
                }
            });
        });
    }
};

