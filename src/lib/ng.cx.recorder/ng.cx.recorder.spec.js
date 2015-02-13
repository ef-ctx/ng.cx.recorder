describe('ng.cx.recorder', function () {
    'use strict';

    beforeEach(module('ng.cx.recorder'));
    beforeEach(module('ng.cx.recorder.templates'));

    describe('SingleMedia', function () {

        it('should throw an error trying to create a SingleMedia object with a non supported tag', inject(function (SingleMedia) {
            expect(function () {
                var a = new SingleMedia(angular.element('<div>')[0]);
            }).toThrow('SingleMedia factory Error: type : div is not supported as media element');
        }));

    });

    describe('userMedia', function () {

        it('should store a configuration property.', inject(function (userMedia) {
            expect(typeof userMedia.getMedia).toBe('function');
        }));

        it('should throw an error when trying to get an unhandled media', inject(function (userMedia) {
            expect(function () {
                userMedia.getMedia('foo');
            }).toThrow('UserMedia.getMedia type: foo is not a valid type of media, it has to be video or audio');
        }));

    });

});

