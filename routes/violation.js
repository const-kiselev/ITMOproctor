var express = require('express');
var router = express.Router();
var db = require('../db');

// Create new violation
router.post('/:examId', function(req, res) {
//   res.json(data);
    var args = {
        userId: req.user._id,
        examId: req.params.examId,
        data: req.body
    };
    var argsForNote = {
        userId: req.user._id,
        examId: req.params.examId,
        data: {
            text: req.body.data,
            attach: req.body.attach,
            editable: false
        }
    };
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