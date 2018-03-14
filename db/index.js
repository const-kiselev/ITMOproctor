var logger = require('../common/logger');
var mongoose = require('mongoose');
var config = require('nconf');
mongoose.connect(config.get('mongoose:uri'));
var conn = mongoose.connection;
var Grid = require('gridfs-stream');
var moment = require('moment');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var db = {
    geoip: function(ip) {
        var geoip = require('geoip-lite');
        var geo = geoip.lookup(ip) || {};
        return geo;
    },
    profile: {
        auth: {
            local: function(username, password, done) {
                var User = require('./models/user');
                User.findOne({
                    username: username,
                    provider: 'local'
                }).select("+hashedPassword +salt").exec(function(err, user) {
                    if (err) {
                        return done(err);
                    }
                    if (!user) {
                        return done(null, false, {
                            message: 'Incorrect username.'
                        });
                    }
                    if (!user.isActive()) {
                        return done(null, false, {
                            message: 'User is inactive.'
                        });
                    }
                    if (!user.validPassword(password)) {
                        return done(null, false, {
                            message: 'Incorrect password.'
                        });
                    }
                    return done(null, user);
                });
            },
            openedu: function(prof, done) {
                var userData = {
                    username: prof.username,
                    firstname: prof.firstname,
                    lastname: prof.lastname,
                    email: prof.email,
                    password: null,
                    provider: config.get('auth:openedu:provider') || 'openedu'
                };
                var User = require('./models/user');
                User.findOne({
                    username: userData.username,
                    provider: userData.provider
                }).exec(function(err, data) {
                    if (err) {
                        return done(err);
                    }
                    if (!data) {
                        var user = new User(userData);
                        user.save(function(err, data) {
                            return done(err, data);
                        });
                    }
                    else {
                        if (!data.isActive()) {
                            return done(null, false, {
                                message: 'User is inactive.'
                            });
                        }
                        return done(null, data);
                    }
                });
            },
            ifmosso: function(prof, done) {
                var userData = {
                    username: prof.ssoid,
                    firstname: prof.firstname,
                    lastname: prof.lastname,
                    middlename: prof.middlename,
                    genderId: prof.gender,
                    birthday: prof.birthdate,
                    email: prof.email,
                    password: null,
                    provider: config.get('auth:ifmosso:provider') || 'ifmosso'
                };
                var User = require('./models/user');
                User.findOne({
                    username: userData.username,
                    provider: userData.provider
                }).exec(function(err, data) {
                    if (err) {
                        return done(err);
                    }
                    if (!data) {
                        var user = new User(userData);
                        user.save(function(err, data) {
                            return done(err, data);
                        });
                    }
                    else {
                        if (!data.isActive()) {
                            return done(null, false, {
                                message: 'User is inactive.'
                            });
                        }
                        return done(null, data);
                    }
                });
            }
        },
        log: function(args, callback) {
            var Logger = require('./models/logger');
            var log = new Logger({
                user: args.userId,
                ip: args.ip
            });
            log.save(callback);
        },
        search: function(args, callback) {
            var query = {};
            if (args.data.role) query.role = Number(args.data.role);
            var rows = args.data.rows ? Number(args.data.rows) : 0;
            var page = args.data.page ? Number(args.data.page) - 1 : 0;
            var text = args.data.text ? args.data.text : null;
            // Fields for text search
            var props = ["lastname", "firstname","middlename","provider","username","email"];
            // Query            
            var User = require('./models/user');
            User.count(query, function(err, count) {
                if (err || !count) return callback(err);
                User.find(query).sort('lastname firstname middlename').exec(function(err, data) {
                        //callback(err, data, count);
                        var users = data;
                        var endIndex = (rows*page + rows) > data.length || (rows*page + rows) === 0 ? data.length : (rows*page + rows);
                        // text search
                        if (text && text != "") {
                            users  = db.textSearch(data, text, props);
                            endIndex = endIndex > users.length ? users.length : endIndex;
                            callback(err, users.slice(rows*page, endIndex), users.length);
                        }
                        else callback(err, users.slice(rows*page, endIndex), users.length);
                    });
            });            
        },
        get: function(args, callback) {
            var User = require('./models/user');
            User.findById(args.userId).exec(callback);
        },
        update: function(args, callback) {
            var User = require('./models/user');
            var attach = db.storage.setId(args.data.attach);
            User.findByIdAndUpdate(args.userId, {
                '$set': {
                    firstname: args.data.firstname,
                    lastname: args.data.lastname,
                    middlename: args.data.middlename,
                    gender: args.data.gender,
                    birthday: args.data.birthday,
                    email: args.data.email,
                    citizenship: args.data.citizenship,
                    documentType: args.data.documentType,
                    documentNumber: args.data.documentNumber,
                    documentIssueDate: args.data.documentIssueDate,
                    address: args.data.address,
                    description: args.data.description,
                    role: args.data.role,
                    active: args.data.active,
                    username: args.data.username,
                    provider: args.data.provider,
                    attach: attach
                }
            }, {
                'new': true
            }, function(err, user) {
                callback(err, user);
                // save virtual field
                if (args.data.password) {
                    user.password = args.data.password;
                    user.save();
                }
                // store attach
                if (!err && user) db.storage.update(attach);
            });
        },
        add: function(args, callback) {
            var User = require('./models/user');
            var user = new User({
                firstname: args.data.firstname,
                password: args.data.password,
                lastname: args.data.lastname,
                middlename: args.data.middlename,
                gender: args.data.gender,
                birthday: args.data.birthday,
                email: args.data.email,
                citizenship: args.data.citizenship,
                documentType: args.data.documentType,
                documentNumber: args.data.documentNumber,
                documentIssueDate: args.data.documentIssueDate,
                address: args.data.address,
                description: args.data.description,
                role: args.data.role,
                active: args.data.active,
                username: args.data.username,
                provider: args.data.provider
            });
            user.save(callback);
        },
        remove: function(args, callback) {
            var User = require('./models/user');
            User.findOneAndRemove({
                _id: args.userId
            }, callback);
        }
    },
    storage: {
        upload: function(files, callback) {
            if (!files) return;
            files.forEach(function(file, i, arr) {
                if (!file.uploadname) return;
                var fullname = path.join('uploads', path.basename(file.uploadname));
                fs.exists(fullname, function(exists) {
                    if (!exists) return;
                    var writestream = db.gfs.createWriteStream({
                        _id: file.fileId,
                        filename: file.filename
                    });
                    fs.createReadStream(fullname).pipe(writestream);
                    writestream.on('close', function(data) {
                        if (callback) callback(data);
                        fs.unlink(fullname);
                    });
                });
            });
        },
        download: {
            user: function(args,callback) {
                db.gfs.findOne({
                    _id: args.fileId
                }, function(err, data) {
                    if (!err && data) {
                        var readstream = db.gfs.createReadStream({
                            _id: args.fileId
                        });
                        readstream.pipe(callback(data));
                    }
                    else callback();
                });              
            },
            chat: function(args,callback) {
                var User = require('./models/user');
                var Exam = require('./models/exam');
                var Member = require('./models/member');
                Exam.findById(args.examId).select({
                    student: 1,
                    inspector: 1                
                }).exec(function(err,data){
                    if (err) callback();
                    var allowed = [];
                    if (data.student) allowed.push(data.student.toString()); 
                    if (data.inspector) allowed.push(data.inspector.toString());
                    Member.find({
                        examId: args.examId
                    }).exec(function(err,data){
                        if (err) callback();
                        data.forEach(function(e,i,a){ allowed.push(e._id.toString()); });
                        User.find({
                            role: 3 // admins
                        }).select('_id').exec(function(err,data){
                            if (err) callback();
                            data.forEach(function(e,i,a){ allowed.push(e._id.toString()); });
                            if (allowed.indexOf(args.sessionUserId) >= 0) {
                                db.gfs.findOne({
                                    _id: args.fileId
                                }, function(err, data) {
                                    if (!err && data) {
                                        var readstream = db.gfs.createReadStream({
                                            _id: args.fileId
                                        });
                                        readstream.pipe(callback(data));
                                    }
                                    else callback();
                                });
                            }
                            else callback();
                        });
                    });
                });
            },
            note: function(args,callback) {
                var User = require('./models/user');
                var Exam = require('./models/exam');
                var Member = require('./models/member');
                Exam.findById(args.examId).select({
                    inspector: 1                
                }).exec(function(err,data){
                    if (err) callback();
                    var allowed = [];
                    if (data.inspector) allowed.push(data.inspector.toString());
                    Member.find({
                        examId: args.examId
                    }).exec(function(err,data){
                        if (err) callback();
                        data.forEach(function(e,i,a){ allowed.push(e._id.toString()); });
                        User.find({
                            role: 3 // admins
                        }).select('_id').exec(function(err,data){
                            if (err) callback();
                            data.forEach(function(e,i,a){ allowed.push(e._id.toString()); });
                            if (allowed.indexOf(args.sessionUserId) >= 0) {
                                db.gfs.findOne({
                                    _id: args.fileId
                                }, function(err, data) {
                                    if (!err && data) {
                                        var readstream = db.gfs.createReadStream({
                                            _id: args.fileId
                                        });
                                        readstream.pipe(callback(data));
                                    }
                                    else callback();
                                });
                            }
                            else callback();
                        });
                    });
                });
            },
            verify: function(args,callback) {
                var User = require('./models/user');
                var allowed = [];
                User.find({
                    role: 3 // admins
                }).select('_id').exec(function(err,data){
                    if (err) callback();
                    data.forEach(function(e,i,a){ allowed.push(e._id.toString()); });
                    if (allowed.indexOf(args.sessionUserId) >= 0) {
                        db.gfs.findOne({
                            _id: args.fileId
                        }, function(err, data) {
                            if (!err && data) {
                                var readstream = db.gfs.createReadStream({
                                    _id: args.fileId
                                });
                                readstream.pipe(callback(data));
                            }
                            else callback();
                        });
                    }
                    else callback();
                });
            },
        },
        remove: function(files, callback) {
            if (!files) return;
            if (!callback) callback = function() {};
            files.forEach(function(file, i, arr) {
                db.gfs.remove({
                    _id: file.fileId
                }, callback);
            });
        },
        update: function(files) {
            if (!files) return;
            var attachAdd = [];
            var attachDel = [];
            for (var i = 0, l = files.length; i < l; i++) {
                if (files[i].removed) {
                    attachDel.push(files[i]);
                }
                else {
                    attachAdd.push(files[i]);
                }
            }
            db.storage.upload(attachAdd);
            db.storage.remove(attachDel);
        },
        setId: function(files) {
            if (!files) return;
            var attach = [];
            for (var i = 0, l = files.length; i < l; i++) {
                if (!files[i].fileId) {
                    files[i].fileId = mongoose.Types.ObjectId();
                }
                if (!files[i].removed) {
                    attach.push(files[i]);
                }
            }
            return attach;
        }
    },
    exam: {
        list: function(args, callback) {
            var Exam = require('./models/exam');
            var query;
            if (String(args.data.history) === 'true') {
                query = {
                    student: args.userId
                };
            }
            else {
                var now = moment();
                query = {
                    '$and': [{
                        student: args.userId
                    }, {
                        rightDate: {
                            '$gt': now
                        }
                    }, {
                        '$or': [{
                            endDate: null
                        }, {
                            endDate: {
                                '$gt': now
                            }
                        }]
                    }]
                };
            }
            Exam.find(query).sort('beginDate subject').exec(callback);
        },
        search: function(args, callback) {
            var rows = args.data.rows ? Number(args.data.rows) : 0;
            var page = args.data.page ? Number(args.data.page) - 1 : 0;
            var fromDate = args.data.from ? moment(args.data.from) : null;
            var toDate = args.data.to ? moment(args.data.to) : null;
            var text = args.data.text ? args.data.text : null;
            var query = {};
            // Dates
            if (fromDate && toDate) {
                query = {
                    '$and': [{
                        leftDate: {
                            "$lt": toDate
                        }
                    }, {
                        rightDate: {
                            "$gt": fromDate
                        }
                    }, {
                        '$or': [{
                            beginDate: null
                        }, {
                            beginDate: {
                                "$lt": toDate
                            }
                        }]
                    }, {
                        '$or': [{
                            endDate: null
                        }, {
                            endDate: {
                                "$gt": fromDate
                            }
                        }]
                    }]
                };
            }
            // If myself
            if (args.userId && String(args.data.myself) !== 'false') {
                query.inspector = args.userId;
            }
            // Populate options
            var opts = [{
                path: 'student',
                select: 'username firstname lastname middlename'
            }, {
                path: 'inspector',
                select: 'username firstname lastname middlename'
            }, {
                path: 'verified',
                select: 'submit hash'
            }];
            // Fields for text search
            var props = ["student", "inspector","duration","subject","examId","examCode"];
            // Query
            var Exam = require('./models/exam');
            Exam.count(query, function(err, count) {
                if (err || !count) return callback(err);
                Exam.find(query).sort('leftDate beginDate subject').populate(opts).exec(function(err, data) {
                    //callback(err, data, count);
                    var exams = data;
                    var endIndex = (rows*page + rows) > data.length || (rows*page + rows) === 0 ? data.length : (rows*page + rows);
                    // text search
                    if (text && text != "") {
                        exams  = db.textSearch(data, text, props);
                        endIndex = endIndex > exams.length ? exams.length : endIndex;
                        callback(err, exams.slice(rows*page, endIndex), exams.length);
                    }
                    else callback(err, exams.slice(rows*page, endIndex), exams.length);
                });
            });
        },
        get: function(args, callback) {
            var Exam = require('./models/exam');
            // get data
            var opts = [{
                path: 'student',
                select: 'provider firstname lastname middlename birthday'
            }, {
                path: 'inspector',
                select: 'firstname lastname middlename'
            }, {
                path: 'verified',
                select: 'submit hash'
            }];
            Exam.findById(args.examId).populate(opts).exec(callback);
        },
        add: function(args, callback) {
            var Exam = require('./models/exam');
            var exam = new Exam({
                subject: args.data.subject,
                examCode: args.data.examCode,
                courseId: args.data.courseId,
                examId: args.data.examId,
                duration: args.data.duration,
                beginDate: args.data.beginDate,
                endDate: args.data.endDate,
                leftDate: args.data.leftDate,
                rightDate: args.data.rightDate,
                startDate: args.data.startDate,
                stopDate: args.data.stopDate,
                resolution: args.data.resolution,
                comment: args.data.comment,
                student: args.data.student,
                inspector: args.data.inspector
            });
            exam.save(callback);
        },
        update: function(args, callback) {
            var Exam = require('./models/exam');
            var data = {
                subject: args.data.subject,
                examCode: args.data.examCode,
                courseId: args.data.courseId,
                examId: args.data.examId,
                duration: args.data.duration,
                beginDate: args.data.beginDate,
                endDate: args.data.endDate,
                leftDate: args.data.leftDate,
                rightDate: args.data.rightDate,
                startDate: args.data.startDate,
                stopDate: args.data.stopDate,
                resolution: args.data.resolution,
                comment: args.data.comment,
                student: args.data.student,
                inspector: args.data.inspector
            };
            var query = {
                _id: args.examId
            };
            if (args.userId) query.inspector = args.userId;
            Exam.findOneAndUpdate(query, {
                '$set': data
            }, {
                'new': true
            }, callback);
        },
        remove: function(args, callback) {
            var Exam = require('./models/exam');
            var query = {
                _id: args.examId
            };
            if (args.userId) query.inspector = args.userId;
            Exam.findOneAndRemove(query, callback);
        },
        plan: function(args, callback) {
            var Exam = require('./models/exam');
            Exam.findOne({
                _id: args.examId,
                student: args.userId
            }).exec(function(err, exam) {
                if (err || !exam) return callback(err);
                var beginDate = moment(args.data.beginDate);
                var interval = Number(config.get('schedule:interval'));
                var duration = Number(exam.duration);
                var endDate = moment(beginDate).add(duration + interval, 'minutes');
                var data = {
                    leftDate: beginDate,
                    rightDate: endDate,
                    duration: duration
                };
                db.exam.schedule({
                    data: data
                }, function(err, data) {
                    if (err || !data) return callback(err);
                    var amount = data.inspectors.length;
                    if (!amount) return callback();
                    Exam.update({
                        _id: args.examId
                    }, {
                        '$set': {
                            // для честного распределения времени инспекторов
                            inspector: data.inspectors[Math.floor(Math.random() * amount)],
                            beginDate: beginDate,
                            endDate: endDate,
                            planDate: moment()
                        }
                    }, callback);
                });
            });
        },
        schedule: function(args, callback) {
            var Exam = require('./models/exam');
            var Schedule = require('./models/schedule');
            var interval = Number(config.get('schedule:interval'));
            var duration = Math.ceil((Number(args.data.duration) + interval) / 60);
            var offset = Number(config.get('schedule:offset'));
            var now = moment().add(offset, 'hours');
            var leftDate = moment.max(now, moment(args.data.leftDate)).startOf('hour');
            var rightDate = moment(args.data.rightDate).add(1, 'hours').startOf('hour');
            var timetable = {};
            Schedule.find({
                '$and': [{
                    beginDate: {
                        '$lt': rightDate
                    }
                }, {
                    endDate: {
                        '$gt': leftDate
                    }
                }]
            }).exec(function(err, schedules) {
                if (err) return callback(err);
                // формируем таблицу доступных рабочих часов каждого инспектора
                for (var i = 0, li = schedules.length; i < li; i++) {
                    var inspector = schedules[i].inspector;
                    var beginDate = moment(schedules[i].beginDate);
                    var endDate = moment(schedules[i].endDate);
                    var concurrent = schedules[i].concurrent;
                    if (!timetable[inspector]) timetable[inspector] = [];
                    var start = beginDate.diff(leftDate, 'hours');
                    var times = moment.min(rightDate, endDate).diff(beginDate, 'hours', true);
                    for (var j = start < 0 ? 0 : start, lj = start + times; j < lj; j++) {
                        if (timetable[inspector][j]) timetable[inspector][j] += concurrent;
                        else timetable[inspector][j] = concurrent;
                    }
                }
                //console.log(timetable);
                Exam.find({
                    '$and': [{
                        beginDate: {
                            '$lt': rightDate
                        }
                    }, {
                        endDate: {
                            '$gt': leftDate
                        }
                    }]
                }).exec(function(err, exams) {
                    if (err) return callback(err);
                    // исключаем из таблицы уже запланированные экзамены
                    for (var i = 0, li = exams.length; i < li; i++) {
                        var inspector = exams[i].inspector;
                        var beginDate = moment(exams[i].beginDate);
                        var endDate = moment(exams[i].endDate);
                        var start = beginDate.diff(leftDate, 'hours');
                        var times = moment.min(rightDate, endDate).diff(beginDate, 'hours', true);
                        for (var j = start < 0 ? 0 : start, lj = start + times; j < lj; j++) {
                            if (timetable[inspector] && timetable[inspector][j] > 0) timetable[inspector][j]--;
                        }
                    }
                    //console.log(timetable);
                    // определяем доступные для записи часы с учетом duration
                    var hours = [];
                    var inspectors = [];
                    for (var inspector in timetable) {
                        var arr = timetable[inspector];
                        var seq = 0;
                        var available = false;
                        for (var m = 0, lm = arr.length; m < lm; m++) {
                            if (!arr[m] > 0) seq = 0;
                            else if (++seq >= duration) {
                                var n = m + 1 - duration;
                                hours.push(n);
                                available = true;
                            }
                        }
                        if (available) inspectors.push(inspector);
                    }
                    //console.log(hours);
                    // сортируем, исключаем повторы и преобразуем в даты
                    var dates = hours.sort(function(a, b) {
                        return a - b;
                    }).filter(function(item, pos, arr) {
                        return !pos || item != arr[pos - 1];
                    }).map(function(v) {
                        return moment(leftDate).add(v, 'hours');
                    });
                    //callback(null, dates);
                    callback(null, {
                        dates: dates,
                        inspectors: inspectors
                    });
                });
            });
        },
        cancel: function(args, callback) {
            var Exam = require('./models/exam');
            var offset = Number(config.get('schedule:offset'));
            var now = moment().add(offset, 'hours').startOf('hour');
            Exam.findOneAndUpdate({
                _id: args.examId,
                student: args.userId,
                beginDate: {
                    '$gte': now
                }
            }, {
                '$set': {
                    beginDate: null,
                    endDate: null,
                    inspector: null
                }
            }, {
                'new': true
            }).exec(callback);
        },
        append: function(args, callback) {
            var Exam = require('./models/exam');
            var isExamExist = function(examId, arr) {
                for (var i = 0, li = arr.length; i < li; i++) {
                    if (examId == arr[i].examId) {
                        return true;
                    }
                }
                return false;
            };
            Exam.find({
                student: args.userId
            }).exec(function(err, exams) {
                if (err || !exams) return callback(err);
                var proctored = args.data;
                var appends = [];
                for (var i = 0, li = proctored.length; i < li; i++) {
                    if (!isExamExist(proctored[i].examId, exams)) {
                        appends.push({
                            //_id: mongoose.Types.ObjectId(),
                            examId: proctored[i].examId,
                            student: args.userId,
                            subject: proctored[i].subject,
                            duration: proctored[i].duration,
                            leftDate: proctored[i].leftDate,
                            rightDate: proctored[i].rightDate
                        });
                    }
                }
                if (!appends.length) return callback();
                var saved = 0;
                for (var j = 0, lj = appends.length; j < lj; j++) {
                    var exam = new Exam(appends[j]);
                    exam.save(function(err, data) {
                        if (err) logger.warn(err);
                        if (++saved === lj) return callback();
                    });
                }
            });
        },
        updateCode: function(args, callback) {
            var User = require('./models/user');
            var Exam = require('./models/exam');
            User.findOne({
                username: args.username,
                provider: args.provider
            }).exec(function(err, user) {
                if (err || !user) return callback(err);
                Exam.findOneAndUpdate({
                    examId: args.examId,
                    student: user._id
                }, {
                    '$set': {
                        examCode: args.examCode
                    }
                }, {
                    'new': true
                }).exec(callback);
            });
        },
        start: function(args, callback) {
            var opts = [{
                path: 'student',
                select: 'provider firstname lastname middlename gender birthday citizenship documentType documentNumber documentIssueDate address description'
            }, {
                path: 'inspector',
                select: 'firstname lastname middlename'
            }];
            var Exam = require('./models/exam');
            Exam.findById(args.examId).exec(function(err, exam) {
                if (err || !exam) return callback(err);
                var query = {};
                if (!exam.startDate && exam.student == args.userId) {
                    query.startDate = moment();
                }
                if (!exam.inspector && exam.student != args.userId) {
                    query.inspector = args.userId;
                }
                if (!exam.inspectorConnected && exam.inspector == args.userId) {
                    query.inspectorConnected = true;
                }
                if (!query) return callback();
                Exam.findByIdAndUpdate(args.examId, {
                    '$set': query
                }, {
                    'new': true
                }).populate(opts).exec(callback);

            });
        },
        finish: function(args, callback) {
            var Exam = require('./models/exam');
            Exam.findOneAndUpdate({
                _id: args.examId,
                inspector: args.userId
            }, {
                '$set': {
                    stopDate: moment(),
                    resolution: args.data.resolution,
                    comment: args.data.comment
                }
            }).exec(callback);
        }
    },
    stats: {
        usersStats: function(args, callback) {
            var query = {};
            // Query
            var User = require('./models/user');
            User.count(query, function(err, count) {
                if (err || !count) return callback(err, 0, 0, 0);
                User.find(query).exec(function(err, data) {
                    var users = data;

                    var totalUsers = users.length;
                    var totalStudents = 0;
                    var totalInspectors = 0;
                    users.forEach(function(element, index, array) {
                        switch (element.role) {
                            case 1:
                                totalStudents++;
                                break;
                            case 2:
                                totalInspectors++;
                                break;
                        }
                    });
                    callback(err, totalUsers, totalStudents, totalInspectors);
                });
            });
        },
        examsStats: function(args, callback) {
            var fromDate = args.data.from ? moment(args.data.from) : null;
            var toDate = args.data.to ? moment(args.data.to) : null;
            var text = args.data.text ? args.data.text : null;
            var query = {};
            // Dates
            if (fromDate && toDate) {
                query = {
                    '$and': [{
                        leftDate: {
                            "$lt": toDate
                        }
                    }, {
                        rightDate: {
                            "$gt": fromDate
                        }
                    }, {
                        '$or': [{
                            beginDate: null
                        }, {
                            beginDate: {
                                "$lt": toDate
                            }
                        }]
                    }, {
                        '$or': [{
                            endDate: null
                        }, {
                            endDate: {
                                "$gt": fromDate
                            }
                        }]
                    }]
                };
            }
            // Fields for text search
            var props = ["subject"];
            // Query
            var Exam = require('./models/exam');
            Exam.count(query, function(err, count) {
                if (err || !count) return callback(err, 0, 0, 0);
                Exam.find(query).exec(function(err, data) {
                    var exams = data;
                    // text search
                    if (text && text != "") {
                        exams  = db.textSearch(data, text, props);
                    }
                    
                    var totalExams = exams.length;
                    var totalAccepted = 0;
                    var totalIntercepted = 0;
                    exams.forEach(function(element, index, array) {
                        switch (element.resolution) {
                            case true:
                                totalAccepted++;
                                break;
                            case false:
                                totalIntercepted++;
                                break;
                        }
                    });
                    callback(err, totalExams, totalAccepted, totalIntercepted);
                });
            });
        }
    },
    verify: {
        get: function(args, callback) {
            var Verify = require('./models/verify');
            Verify.findById(args.verifyId).exec(callback);
        },
        submit: function(args, callback) {
            var data = {
                submit: args.data.submit,
                firstname: args.data.firstname,
                lastname: args.data.lastname,
                middlename: args.data.middlename,
                gender: args.data.gender,
                birthday: args.data.birthday,
                citizenship: args.data.citizenship,
                documentType: args.data.documentType,
                documentNumber: args.data.documentNumber,
                documentIssueDate: args.data.documentIssueDate
            };
            data.hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
            data.inspector = args.userId;
            data.student = args.data.studentId;
            data.exam = args.data.examId;
            data.address = args.data.address;
            data.description = args.data.description;
            data.attach = db.storage.setId(args.data.attach);
            //logger.debug(data);
            var Verify = require('./models/verify');
            var verify = new Verify(data);
            verify.save(function(err, data) {
                callback(err, data);
                var Exam = require('./models/exam');
                Exam.update({
                    _id: args.data.examId
                }, {
                    '$set': {
                        'verified': data._id
                    }
                }).exec();
                db.storage.upload(args.data.attach);
            });
        }
    },
    schedule: {
        list: function(args, callback) {
            var Schedule = require('./models/schedule');
            Schedule.find({
                inspector: args.userId,
                endDate: {
                    '$gte': moment()
                }
            }).sort('beginDate').exec(callback);
        },
        search: function(args, callback) {
            var rows = args.data.rows ? Number(args.data.rows) : 0;
            var page = args.data.page ? Number(args.data.page) - 1 : 0;
            var fromDate = args.data.from ? moment(args.data.from) : null;
            var toDate = args.data.to ? moment(args.data.to) : null;
            var text = args.data.text ? args.data.text : null;
            var query = {};
            // Dates
            if (fromDate && toDate) {
                query.beginDate = {
                    "$lte": toDate
                };
                query.endDate = {
                    "$gte": fromDate
                };
            }
            // Populate options
            var opts = [{
                path: 'inspector',
                select: 'username firstname lastname middlename'
            }];
            // Fields for text search
            var props = ["inspector"];
            // Query
            var Schedule = require('./models/schedule');
            Schedule.count(query, function(err, count) {
                if (err || !count) return callback(err);
                Schedule.find(query).sort('beginDate').populate(opts).exec(function(err, data) {
                        //callback(err, data, count);
                        var schedules = data;
                        var endIndex = (rows*page + rows) > data.length || (rows*page + rows) === 0 ? data.length : (rows*page + rows);
                        // text search
                        if (text && text != "") {
                            schedules  = db.textSearch(data, text, props);
                            endIndex = endIndex > schedules.length ? schedules.length : endIndex;
                            callback(err, schedules.slice(rows*page, endIndex), schedules.length);
                        }
                        else callback(err, schedules.slice(rows*page, endIndex), schedules.length);
                    });
            });
        },
        get: function(args, callback) {
            var Schedule = require('./models/schedule');
            Schedule.findById(args.scheduleId).exec(callback);
        },
        add: function(args, callback) {
            var Schedule = require('./models/schedule');
            var beginDate = moment(args.data.beginDate).startOf('hour');
            var endDate = moment(args.data.endDate).startOf('hour');
            var offset = Number(config.get('schedule:offset'));
            var now = moment().add(offset, 'hours').startOf('hour');
            if (beginDate >= endDate || beginDate < now ||
                args.data.concurrent < 1) return callback();
            var schedule = new Schedule({
                inspector: args.userId || args.data.inspector,
                beginDate: beginDate,
                endDate: endDate,
                concurrent: args.data.concurrent
            });
            schedule.save(callback);
        },
        update: function(args, callback) {
            var Schedule = require('./models/schedule');
            var data = {
                inspector: args.data.inspector,
                beginDate: args.data.beginDate,
                endDate: args.data.endDate,
                concurrent: args.data.concurrent
            };
            var query = {
                _id: args.scheduleId
            };
            if (args.userId) query.inspector = args.userId;
            Schedule.findOneAndUpdate(query, {
                '$set': data
            }, {
                'new': true
            }, callback);
        },
        remove: function(args, callback) {
            var Schedule = require('./models/schedule');
            var query = {
                _id: args.scheduleId
            };
            if (args.userId) query.inspector = args.userId;
            Schedule.findOneAndRemove(query, callback);
        }
    },
    notes: {
        list: function(args, callback) {
            // Populate options
            var opts = [{
                path: 'author',
                select: 'firstname lastname middlename',
            }];
            var Note = require('./models/note');
            Note.find({
                exam: args.examId
            }).populate(opts).sort('time').exec(callback);
        },
        add: function(args, callback) {
            var Note = require('./models/note');
            var note = new Note({
                exam: args.examId,
                author: args.userId,
                text: args.data.text,
                attach: db.storage.setId(args.data.attach),
                editable: args.data.editable
            });
            note.save(function(err, data) {
                callback(err, data);
                db.storage.upload(args.data.attach);
            });
        },
        update: function(args, callback) {
            var Note = require('./models/note');
            Note.update({
                _id: args.noteId,
                exam: args.examId,
                author: args.userId,
                editable: true
            }, {
                '$set': {
                    author: args.userId,
                    text: args.data.text
                }
            }, {
                'new': true
            }, callback);
        },
        remove: function(args, callback) {
            var Note = require('./models/note');
            Note.findOneAndRemove({
                _id: args.noteId,
                exam: args.examId,
                author: args.userId,
                editable: true
            }, function(err, data) {
                callback(err, data);
                if (!err && data) db.storage.remove(data.attach);
            });
        }
    },
    chat: {
        list: function(args, callback) {
            var Chat = require('./models/chat');
            // Populate options
            var opts = [{
                path: 'author',
                select: 'firstname lastname middlename',
            }];
            Chat.find({
                exam: args.examId
            }).populate(opts).sort('time').exec(callback);
        },
        add: function(args, callback) {
            var Chat = require('./models/chat');
            var chat = new Chat({
                exam: args.examId,
                author: args.userId,
                text: args.data.text,
                attach: db.storage.setId(args.data.attach)
            });
            chat.save(function(err, data) {
                if (err || !data) callback(err, data);
                else {
                    Chat.populate(data, {
                        path: 'author',
                        select: 'firstname lastname middlename'
                    }, callback);
                    db.storage.upload(args.data.attach);
                }
            });
        }
    },
    members: {
        list: function(args, callback) {
            var Member = require('./models/member');
            // Populate options
            var opts = [{
                path: 'user',
                select: 'firstname lastname middlename role roleName'
            }, {
                path: 'exam',
                select: 'student inspector'
            }];
            Member.find({
                exam: args.examId
            }).sort('time').populate(opts).exec(callback);
        },
        update: function(args, callback) {
            var geo = db.geoip(args.ip);
            var Member = require('./models/member');
            Member.findOneAndUpdate({
                exam: args.examId,
                user: args.userId
            }, {
                exam: args.examId,
                user: args.userId,
                time: Date.now(),
                ip: args.ip,
                country: geo.country,
                city: geo.city
            }, {
                upsert: true
            }, callback);
        }
    },
    rest: {
        create: function(args, callback) {
            try {
                var model = require('./models/' + args.collection);
                model.create(args.data, callback);
            }
            catch (err) {
                return callback(err);
            }
        },
        read: function(args, callback) {
            try {
                var model = require('./models/' + args.collection);
                var transaction = model.find(args.query);
                if (args.skip) transaction.skip(args.skip);
                if (args.limit) transaction.limit(args.limit);
                if (args.sort) transaction.sort(args.sort);
                if (args.select) transaction.select(args.select);
                if (args.populate) transaction.populate(args.populate);
                transaction.exec(callback);
            }
            catch (err) {
                return callback(err);
            }
        },
        update: function(args, callback) {
            try {
                var model = require('./models/' + args.collection);
                delete args.data._id;
                model.findByIdAndUpdate(args.documentId, args.data, {
                    'new': true
                }, callback);
            }
            catch (err) {
                return callback(err);
            }
        },
        delete: function(args, callback) {
            try {
                var model = require('./models/' + args.collection);
                model.findByIdAndRemove(args.documentId, callback);
            }
            catch (err) {
                return callback(err);
            }
        }
    },
    textSearch: function(data, text, props) {
        // Text search based on props of the object
        if (!data || !(text || "").length) return data;
        var objectToString = function(obj,parent) {
            var result = "";
            for (var prop in obj) {
                if (props.indexOf(prop) >= 0 || props.indexOf(parent) >= 0 ) {
                    if (obj[prop] instanceof Object) {
                        result += objectToString(obj[prop],prop);
                    }
                    if (typeof obj[prop] === 'string') result += obj[prop] + " ";        
                }
            }
            return result;
        };
        var phrases = text.toLowerCase().split(' ');
        var rows = [];
        for (var i = 0, li = data.length; i < li; i++) {
            var str = objectToString(JSON.parse(JSON.stringify(data[i]))).toLowerCase();
            var cond = true;
            for (var j = 0, lj = phrases.length; j < lj; j++) {
                if (str.search(phrases[j]) === -1) {
                    cond = false;
                    break;
                }
            }
            if (cond) rows.push(data[i]);
        }
        return rows;
    },
    violation: {
        add: function(args, callback) {
            var Violation = require('./models/violation');
            var violation = new Violation({
              exam: args.examId,
              mehtod: args.method,
              data: args.data.data,
              time: args.data.time,
              attach: db.storage.setId(args.data.attach)
            });
            violation.save(function(err, data) {
                callback(err, data);
                db.storage.upload(args.data.attach);
            });
        }
    }
};
conn.on('error', function(err) {
    logger.error("MongoDB connection error: " + err.message);
});
conn.once('open', function() {
    logger.info("MongoDb is connected");
    db.gfs = Grid(conn.db, mongoose.mongo);
});
db.mongoose = mongoose;
module.exports = db;