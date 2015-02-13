/* jshint loopfunc:true */
/* globals RecordRTC:true */

(function (angular) {
    'use strict';

    var module = angular.module('ng.cx.recorder', ['ng.cx.recorder.templates']);

    var MEDIA_CONSTRAINTS = {
        video: {
            // camera constraints
            capture: {
                video: {
                    mandatory: {
                        maxWidth: 640,
                        maxHeight: 480
                    }
                },
                audio: false
            },
            // recordRTC library recording constraints
            record: {
                type: 'video',
                video: {
                    width: 640,
                    height: 480,
                    frameRate: 10
                },
                canvas: {
                    width: 640,
                    height: 480,
                    frameRate: 10
                }
            }
        },
        audio: {
            // camera constraints
            capture: {
                video: false,
                audio: true
            },

            // recordRTC library recording constraints
            record: {
                type: 'audio'
            }
        }
    };

    var MEDIA_TYPE = {
        audio: 'audio',
        video: 'video'
    };

    var MEDIA_STATE = {
        capturing: 'capturing',
        recording: 'recording',
        playing: 'playing',
        paused: 'paused',
        stopped: 'stopped',
    };

    /**
     * @ngdoc object
     * @name ng.cx.recorder.service:userMedia
     *
     * @description
     *      Ask the user to get the camera / microphone stream.
     *      The service shims navigator.getUserMedia to make it work in all browsers and handles error if getUserMedia is not supported.
     **/
    module.service('userMedia', [
        '$q',
        '$window',
        function ($q, $window) {

            // interface for the user agent, it will provide the ways to access the camera and the microphne
            var navigator = $window.navigator;

            var constraints = {
                audio: MEDIA_CONSTRAINTS.audio.capture,
                video: MEDIA_CONSTRAINTS.video.capture
            };

            // get the navigator and the proper userMedia for each browser
            var getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);

            /**
             * Asks the user to use the camera and/or the microphone and returns a promise providing the stream and an URL object where the stream
             * will be used.
             *
             * navigator.getUserMedia: Prompts the user for permission to use a media device such as a camera or microphone.
             * If the user provides permission, the successCallback is invoked on the calling application with a LocalMediaStream object as its argument.
             *
             * @param {Object} constants: constraints for the media to be captured.
             *
             * @returns {Object} promise which will be resolved after the user allow / reject the use of the media capturer
             *
             **/
            function getMedia(constraints) {
                var dfd = $q.defer();
                var stream;

                if (!navigator.getMedia) {
                    getUserMedia.call(navigator, constraints, function (_stream) {
                        stream = {
                            source: _stream,
                            url: $window.URL.createObjectURL(_stream)
                        };
                        dfd.resolve(stream);
                    }, function (error) {
                        //@todo handle user reject and etc.
                        dfd.reject(error);
                    });
                } else {
                    dfd.reject('getUserMedia() is not supported in your browser');
                }
                return dfd.promise;
            }

            /**
             * @ngdoc function
             * @name getMediaByType
             * @methodOf ng.cx.recorder.service:userMedia
             *
             * @description
             *
             * Shortcut for getMedia with video / audio constraints
             *
             * @param {String} type
             * Indicates the type of media to be captured
             *
             * @returns {Object}
             * <p> A promise which will be resolved when the user grant the access to the camera / microphone. </p>
             * <p> the promise will resolve an object with the stream and the url Object to retrieve the stream </p>
             *
             **/
            function getMediaByType(type) {
                if (constraints.hasOwnProperty(type)) {
                    return getMedia(constraints[type]);
                } else {
                    throw new Error('UserMedia.getMedia type: ' + type + ' is not a valid type of media, it has to be video or audio');
                }
            }

            return {
                getMedia: getMediaByType
            };

        }
    ]);

    /**
     * @ngdoc object
     * @name ng.cx.recorder.factory:SingleMedia
     *
     * @description
     *      Extend Media Objects adding record and capture handling
     **/
    module.factory('SingleMedia', [
        '$q',
        'userMedia',
        function singleMediaFactory($q, userMedia) {

            var SingleMedia = function (element, sourceUrl) {

                // --------------------- PROPERTIES
                var _type;
                var _constraints;
                var _stream;
                var _streamUrl;
                var _element;
                var _blobUrl;
                var _recorder;
                var _state = MEDIA_STATE.stopped;

                /**
                 * @ngdoc function
                 * @name capture
                 * @methodOf ng.cx.recorder.factory:SingleMedia
                 *
                 * @description
                 *
                 * @param {string} type Media type it could be 'audio' or 'video'
                 *
                 * @return {Object} promise
                 **/
                function capture() {

                    var dfd = $q.defer();

                    if (_streamUrl) {
                        dfd.resolve(_streamUrl);
                    } else {
                        userMedia.getMedia(_type).then(function (stream) {
                            dfd.resolve(stream);
                        });
                    }

                    _state = MEDIA_STATE.capturing;

                    return dfd.promise;
                }

                /**
                 * @ngdoc function
                 * @name stopStream
                 * @methodOf ng.cx.recorder.factory:SingleMedia
                 *
                 * @description
                 * Stop capturing
                 **/
                function stopStream() {
                    _stream.stop();
                }

                /**
                 * @ngdoc function
                 * @name record
                 * @methodOf ng.cx.recorder.factory:SingleMedia
                 *
                 * @description
                 * Start recording
                 **/
                function record() {
                    _recorder.startRecording();
                    _state = MEDIA_STATE.recording;
                }

                /**
                 * @ngdoc function
                 * @name stopRecording
                 * @methodOf ng.cx.recorder.factory:SingleMedia
                 *
                 * @description
                 * Stops recording and sets the result as the src of the element
                 **/
                function stopRecording() {

                    _recorder.stopRecording(function (url) {
                        _blobUrl = url;
                        _element.src = url;
                        play();
                    });

                    _state = MEDIA_STATE.stopped;
                }

                /**
                 * @ngdoc function
                 * @name play
                 * @methodOf ng.cx.recorder.factory:SingleMedia
                 *
                 * @description
                 * Plays all media elements
                 **/
                function play() {
                    _element.play();
                    _element.volume = 0.5;
                    _state = MEDIA_STATE.playing;
                }

                /**
                 * @ngdoc function
                 * @name pause
                 * @methodOf ng.cx.recorder.factory:SingleMedia
                 *
                 * @description
                 * pause all media elements at the same time
                 **/
                function pause() {
                    _element.pause();
                    _state = MEDIA_STATE.paused;
                }

                /**
                 * @ngdoc function
                 * @name stop
                 * @methodOf ng.cx.recorder.factory:SingleMedia
                 *
                 * @description
                 * Stops recording if it is recording or pause and move to second 0 if it is playing
                 **/
                function stop() {
                    if (_state === MEDIA_STATE.recording) {
                        stopRecording();
                    } else {
                        pause();
                    }
                    _element.currentTime = 0;
                }

                function init() {

                    _type = element.tagName.toLowerCase();

                    if (MEDIA_TYPE.hasOwnProperty(_type)) {

                        _constraints = MEDIA_CONSTRAINTS[_type];

                        _element = element;
                        _element.autoplay = true;
                        _element.volume = 0;

                        if (sourceUrl) {
                            _element.src = sourceUrl;
                        } else {
                            capture().then(function (stream) {
                                _stream = stream.source;
                                _streamUrl = stream.url;
                                _element.src = _streamUrl;
                                _recorder = new RecordRTC(stream.source, _constraints.record);
                            });
                        }

                    } else {
                        throw new Error('SingleMedia factory Error: type : ' + _type + ' is not supported as media element');

                    }

                }

                init();

                // --------------------- METHODS

                this.play = play;
                this.stop = stop;
                this.pause = pause;
                this.record = record;
                this.capture = capture;
                this.stopStream = stopStream;

                Object.defineProperty(this, 'hasRecording', {
                    get: function () {
                        return (!!_blobUrl);
                    }
                });
            };

            return SingleMedia;
        }

    ]);

    /**
     * @ngdoc object
     * @name ng.cx.recorder.MediaHandler
     *
     * @description
     *      Handles media.
     *      As far as there's no standarized way of handle media across different browsers and
     *      most of them does not allow us to handle different media as one single entity
     *      the Media handler will do all of this:
     *      <ul>
     *          <li>Capture</li>
     *          <li>Record</li>
     *          <li>Stop Recording</li>
     *          <li>Play</li>
     *          <li>Pause</li>
     *          <li>Stop Playing</li>
     *      </ul>
     *
     **/
    module.factory('MediaHandler', [
        '$interval',
        'SingleMedia',
        function mediaFactory($interval, SingleMedia) {

            // constructor
            var MediaHandler = function () {

                var mediaObjects = [];

                var time = {
                    duration: 0,
                    track: 0
                };

                var interval;
                var state = MEDIA_STATE.stopped;

                function trackTime() {
                    var current;

                    switch (state) {

                    case MEDIA_STATE.recording:
                        time.duration = 0;
                        interval = $interval(function () {
                            time.duration++;
                            console.log('RECORDING : ', time.duration);
                        }, 100);
                        console.log('tracking time RECORDING');

                        break;

                    case MEDIA_STATE.stopped:
                        $interval.cancel(interval);
                        time.track = 0;
                        console.log('tracking time STOPPED');
                        break;

                    case MEDIA_STATE.paused:
                        $interval.cancel(interval);
                        console.log('tracking time PAUSED');
                        break;

                    case MEDIA_STATE.playing:
                        interval = $interval(function () {
                            time.track++;
                            console.log('PLAYING: ', time.duration);
                        }, 100);
                        console.log('tracking time PLAYING');

                        break;
                    }

                }

                /**
                 * @ngdoc function
                 * @name addMediaElement
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 *
                 * @param {Object} element The media dom element. This is NOT a jQuery / jqLite object
                 * @param {string} sourceUrl The url which will act as the source for the media element. (optional)
                 * If the sourceUrl is not provided, MediaHandler will try to capture the media from the system.
                 **/
                function addMediaElement(element, sourceUrl) {
                    mediaObjects.push(new SingleMedia(element, sourceUrl));
                }

                /**
                 * @ngdoc function
                 * @name capture
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 *
                 * @param {string} type Media type it could be 'audio' or 'video'
                 *
                 * @return {Object} promise
                 **/
                function capture(type) {
                    mediaObjects.forEach(function (media) {
                        media.capture();
                    });
                    state = MEDIA_STATE.capturing;
                }

                /**
                 * @ngdoc function
                 * @name stopStream
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 * Stop capturing
                 **/
                function stopStream() {
                    mediaObjects.forEach(function (media) {
                        media.stopStream();
                    });
                    state = MEDIA_STATE.stopped;
                }

                /**
                 * @ngdoc function
                 * @name record
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 * Start recording
                 **/
                function record() {
                    mediaObjects.forEach(function (media) {
                        media.record();
                    });

                    state = MEDIA_STATE.recording;

                    trackTime();
                }

                /**
                 * @ngdoc function
                 * @name stopRecording
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 * Stops recording and returns a promise which will resolve in an object containing the blobs and the urls to fetch them
                 **/
                function stop() {
                    mediaObjects.forEach(function (media) {
                        media.stop();
                    });

                    if (state === MEDIA_STATE.recording) {
                        state = MEDIA_STATE.paused;
                    } else {
                        state = MEDIA_STATE.stopped;
                    }

                    trackTime();
                }

                /**
                 * @ngdoc function
                 * @name play
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 * Plays all media elements
                 **/
                function play() {
                    mediaObjects.forEach(function (media) {
                        media.play();
                    });

                    state = MEDIA_STATE.playing;

                    trackTime();
                }

                /**
                 * @ngdoc function
                 * @name pause
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 * pause all media elements at the same time
                 **/
                function pause() {
                    mediaObjects.forEach(function (media) {
                        media.pause();
                    });

                    state = MEDIA_STATE.paused;

                    trackTime();
                }

                this.addMediaElement = addMediaElement;
                this.capture = capture;
                this.stopStream = stopStream;
                this.record = record;
                this.play = play;
                this.pause = pause;
                this.stop = stop;

                Object.defineProperty(this, 'state', {
                    get: function () {
                        return state;
                    }
                });

                Object.defineProperty(this, 'duration', {
                    get: function () {
                        return time.duration;
                    }
                });

                Object.defineProperty(this, 'currentTime', {
                    get: function () {
                        return time.track;
                    }
                });
            };

            return MediaHandler;
        }
    ]);

    /**
     * @ngdoc directive
     * @name ng.cx.recorder.directive:recorderControls
     * @description media control bar for audio / video
     * @example
     * <div style="background-color:red">
     *      <rec-wrapper></rec-wrapper>
     * </div>
     */
    module.directive('recorderControls', [
        '$rootScope',
        'MediaHandler',
        function recorderControls($rootScope, MediaHandler) {

            return {
                restrict: 'A',
                templateUrl: 'lib/ng.cx.recorder/ng.cx.recorder.tpl.html',
                replace: 'element',
                scope: {
                    videoUrl: '=',
                    audioUrl: '=',
                    minified: '=',
                    mediaType: '@',
                    videoRecordedHandler: '=',
                    videoDeletedHandler: '=',
                    registerControlsApi: '='
                },
                link: function ($scope, $element) {

                    /*
                                    var media = {};

                                    var $audio, audio;
                                    var $video, video;
                                    var recordedSeconds;
                                    var trackProgress;
                                    var maxRecordingTimeAllowedms;
                                    var startRecordingTime;
                    */
                    // ---------------------------------------------------------------------------------------------------------------------------------------- MEDIA HANDLING

                    // ------------------------------------------------------------------------------------- HELPERS
                    /*
                    function setMediaCurrentTime(time) {
                        for (var ix in media) {
                            media[ix].el.currentTime = time;
                        }

                        updateProgress(time, $scope.mediaDuration);

                        if ($scope.currentState === MEDIA_STATE.playing) {
                            play();
                        }
                    }

                    function updateProgress(current, total) {
                        var percentage = Math.floor((100 / total) * current);
                        $scope.$evalAsync(function() {
                            $scope.playbackProgress = current;
                            $scope.playbackProgressPercentage = isNaN(percentage) ? 0 : percentage;
                            $scope.playbackProgressDate.setSeconds(current);
                        });
                    }
                    */
                    // ------------------------------------------------------------------------------------- HANDLING MEDIA EVENTS

                    /**
                     * Handles playing event from the video element
                    function handleMediaTimeUpdate() {
                        if (trackProgress) {
                            // while recording the progress bar should be the percentage beween
                            // the time recorded and the maximum time allowed
                            if ($scope.currentState === MEDIA_STATE.recording) {

                                // the recorded time
                                // @TODO: we can't track time from an specific component as far as we don't know which component will be instantiated.
                                // We should track as the audio Reconder
                                recordedSeconds = Math.floor(media.video.el.currentTime - startRecordingTime);

                                if (recordedSeconds >= maxRecordingTimeAllowedms) {
                                    stopRecording();
                                    handleMediaEnd();
                                } else {
                                    updateProgress(recordedSeconds, maxRecordingTimeAllowedms);
                                }

                            } else if ($scope.currentState === MEDIA_STATE.playing) {
                                updateProgress(Math.floor(media.video.el.currentTime), $scope.mediaDuration);
                            }
                        }
                    }

                    /**
                     * Handles the media ending.
                    function handleMediaEnd() {
                        pause();
                        setMediaCurrentTime(0);
                        $scope.currentState = MEDIA_STATE.paused;
                    }

                    function handleMediaError() {
                        $scope.$evalAsync(function() {
                            setMediaCurrentTime(0);
                        });
                    }

                    function handleLoadedData() {
                        $scope.mediaDuration = Math.floor(media.video.el.duration);
                    }

                    // ------------------------------------------------------------------------------------- PAUSE / STOP

                    function pause() {

                        for (var ix in media) {
                            media[ix].el.pause();
                            media[ix].el.volume = 0;
                        }

                        // STOP PLAYING
                        $scope.currentState = MEDIA_STATE.paused;
                    }


                    // ------------------------------------------------------------------------------------- RECORDING

                    /**
                     * records the audio and video streams and call handleRecording to manage the data to display
                    function record() {
                        mediaHandler.startRecording();
                        // @TODO: we can't track time from an specific component as far as we don't know which component will be instantiated.
                        // We should track as the audio Reconder
                        startRecordingTime = media.video.el.currentTime;
                        $scope.currentState = MEDIA_STATE.recording;
                    }
                    */

                    /*function stopRecording() {
                        mediaHandler.stopRecording().then(function(mediaHash) {

                            for (var ix in media) {
                                if (mediaHash.hasOwnProperty(ix)) {
                                    media[ix].el.src = mediaHash[ix].blobUrl;
                                    media[ix].el.pause();
                                }
                            }

                            $scope.$evalAsync(function() {
                                $scope.mediaDuration = recordedSeconds;
                                $scope.playbackProgressDate.setSeconds(recordedSeconds);
                            });

                            if ($scope.mediaRecordedHandler) {
                                $scope.mediaRecordedHandler(mediaHash);
                            }

                        });

                        setMediaCurrentTime(0);

                        // STOP PLAYING
                        $scope.currentState = MEDIA_STATE.paused;
                    }*/

                    // ------------------------------------------------------------------------------------- CAPTURING

                    /**
                     * captures the stream provided by the media handler wich takes the stream from the microphone or the camera of the user
                    function capture(mediaObj) {

                        if (mediaObj.streamUrl) {
                            mediaObj.el.src = mediaObj.streamUrl;
                        } else {
                            mediaHandler.capture(mediaObj.type).then(function(url) {
                                mediaObj.el.src = url;
                                mediaObj.streamUrl = url;
                                mediaObj.captureAllowed = true;
                            });
                        }
                    }

                    // ------------------------------------------------------------------------------------- MUTE / UNMUTE

                    function mute() {
                        if (media.hasOwnProperty(audio)) {
                            media.audio.el.muted = true;
                        }
                    }

                    function unmute() {
                        if (media.hasOwnProperty(audio)) {
                            media.audio.el.muted = false;
                        }
                    }

                    **/
                    // ----------------------------------------------------------------------------------------------------------------------------------------- STATE HANDLING

                    $scope.MEDIA_STATE = MEDIA_STATE;

                    $scope.captureAllowed = {
                        video: true,
                        audio: true
                    };

                    var steps = {};

                    $scope.changeState = function () {
                        steps[$scope.mediaHandler.state]();
                    };

                    $scope.seek = function () {
                        /*trackProgress = true;
                        setMediaCurrentTime($scope.playbackProgress);*/
                    };

                    $scope.pauseProgressTracking = function () {
                        //trackProgress = false;
                    };

                    $scope.rangeChangeHandler = function () {
                        //updateProgress($scope.playbackProgress, $scope.mediaDuration);
                    };

                    /**
                     * Removes the recorded video and stops playing, returning to capture mode
                     */
                    $scope.removeRecording = function () {
                        /*dialog.confirm('Remove video', 'This will remove the recorded video, do you want to remove it?', 'Remove').then(function() {

                            capture('video');
                            capture('audio');

                            if ($scope.videoDeletedHandler) {
                                $scope.videoDeletedHandler();
                            }

                        });*/
                    };

                    /**
                     * when the tool is removed it stops capturing video and audio
                     */
                    $scope.$on('$destroy', function () {
                        $scope.mediaHandler.stop();
                        $scope.mediaHandler.stopStream();
                    });
                    // ---------------------------------------------------------------------------------------------------------------------------------------- INITIALIZATION

                    /**
                     * Initialization of the directive
                     **/
                    function init() {
                        $scope.mediaHandler = new MediaHandler();
                        $scope.mediaHandler.addMediaElement(angular.element('<audio>')[0]);

                        /**
                         *  stop --> record --> paused --> playing
                         *                        ^           |
                         *                        |           v
                         *                         -----------
                         */
                        // stopped -> record;
                        steps[MEDIA_STATE.stopped] = $scope.mediaHandler.record;
                        // record -> stop;
                        steps[MEDIA_STATE.recording] = $scope.mediaHandler.stop;
                        // stop -> play;
                        steps[MEDIA_STATE.paused] = $scope.mediaHandler.play;
                        // play -> pause;
                        steps[MEDIA_STATE.playing] = $scope.mediaHandler.pause;

                        /**
                         *  EXPOSE THE API
                         */
                        if ($scope.registerControlsApi) {
                            /*$scope.registerControlsApi({
                                record: record,
                                play: play,
                                stop: stop,
                                mute: mute,
                                unmute: unmute
                            });*/
                        }

                    }

                    $scope.maxDuration = 20;

                    /**
                     * video component initializes when a message with the element is broadcasted from a parent scope
                     **/
                    $scope.$on('classroom.tool.recorderVideo.bindElement', function (evt, $videoElement) {
                        $scope.mediaHandler.addMediaElement($videoElement[0], $scope.videoUrl);
                        console.log('test', $videoElement);

                    });

                    init();

                }
            };
        }
    ]);

})(angular);

