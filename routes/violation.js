var express = require('express');
var router = express.Router();
var db = require('../db');
var logger = require('../common/logger');

// Create new violation
router.post('/:examId', function(req, res) {
//   res.json(data);
  console.log(req.body);
    var args = {
        userId: req.user._id,
        examId: req.params.examId,
        data: {
          time: req.body.time,
          data: req.body.data[0],
          method: req.body.method,
          attach: req.body.attach
        }
    };
    var argsForNote = {
        userId: req.user._id,
        examId: req.params.examId,
        data: {
            text: req.body.data[1],
            attach: req.body.attach,
            editable: false
        }
    };
    logger.debug("violation.js --------------------------------------------------------------------");
    console.log(args.data);
    db.violation.add(args, function(err, data) {
        if (!err && data) {
            res.json(data);
            req.notify('violation-' + args.examId, {
                userId: args.userId
            });
        }
        else {
            console.log(err);
            res.status(400).end();
        }
    });
    
    db.notes.add(argsForNote, function(err, data) {
        if (!err && data) {
            console.log("note-violation added");
            req.notify('notes-' + args.examId, {
                userId: args.userId
            });
        }
        else {
            res.status(400).end();
        }
    });
});

module.exports = router;