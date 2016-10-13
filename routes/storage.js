var express = require('express');
var router = express.Router();
var config = require('nconf');
var db = require('../db');
var multer = require('multer');
var fs = require('fs');
var urlify = require('urlify').create();
var upload = multer({
    dest: './uploads/',
    limits: {
        fileSize: config.get("upload:limit") * 1024 * 1024, // MB
        files: 1
    },
    onFileSizeLimit: function(file) {
        fs.unlink('./' + file.path); // delete the partially written file
        file.failed = true;
    }
});
// Upload attach
router.post('/', upload.any(), function(req, res, next) {
    var file = req.files[0];
    if (!file) {
        var err = new Error('Bad Request');
            err.status = 400;
        return next(err);
    }
    var fname = file.originalname;
    var name = fname.slice(0, fname.lastIndexOf('.'));
    var ext = fname.slice(fname.lastIndexOf('.') + 1);
    file.originalname = urlify(name) + '.' + urlify(ext);
    res.json(file);
});
// Download attach from user
router.get('/user/:userId/:fileId', function(req, res, next) {
    var args = {
        sessionUserId: req.user._id,
        userId: req.params.userId,
        fileId: req.params.fileId
    };
    db.storage.download.user(args, function(data) {
        if (!data) {
            var err = new Error('Not Found');
                err.status = 404;
            return next(err);
        }
        res.header('Content-Disposition', 'attachment; filename="' + data.filename + '"');
        return res;
    });
});
// Download attach from chat
router.get('/chat/:examId/:fileId', function(req, res, next) {
    var args = {
        sessionUserId: req.user._id,
        examId: req.params.examId,
        fileId: req.params.fileId
    };
    db.storage.download.chat(args, function(data) {
        if (!data) {
            var err = new Error('Not Found');
                err.status = 404;
            return next(err);
        }
        res.header('Content-Disposition', 'attachment; filename="' + data.filename + '"');
        return res;
    });
});
// Download attach from notes
router.get('/note/:examId/:fileId', function(req, res, next) {
    var args = {
        sessionUserId: req.user._id,
        examId: req.params.examId,
        fileId: req.params.fileId
    };
    db.storage.download.note(args, function(data) {
        if (!data) {
            var err = new Error('Not Found');
                err.status = 404;
            return next(err);
        }
        res.header('Content-Disposition', 'attachment; filename="' + data.filename + '"');
        return res;
    });
});
// Download attach from verify-page
router.get('/verify/:examId/:fileId', function(req, res, next) {
    var args = {
        sessionUserId: req.user._id,
        examId: req.params.examId,
        fileId: req.params.fileId
    };
    db.storage.download.verify(args, function(data) {
        if (!data) {
            var err = new Error('Not Found');
                err.status = 404;
            return next(err);
        }
        res.header('Content-Disposition', 'attachment; filename="' + data.filename + '"');
        return res;
    });
});
module.exports = router;