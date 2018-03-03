/**
 * Модель анализа видео экзамена
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Exam = require('./exam').schema;
var Attach = require('./attach').schema;
var Violation = new Schema({
    // Идентификатор экзамена (связь N:1)
    exam: {
        type: Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    // Алгоритм, с помощью которого зафиксировано нарушение
    method: {
        type: Number,
        // enum: [0: 'faceTracking', 1: 'faceRecognition']
    },
    // Дополнительные данные о нарушении
    data: {
        type: String,
    },
    // Время нарушения
    time: {
        type: Date,
        default: Date.now
    },
    // Ошибка распознавания нарушения
    error: {
        type: Boolean,
        default: false
    },
    // Ссылка на вложение с нарушением
    attach: [Attach]
});
module.exports = mongoose.model('Violation', Violation);