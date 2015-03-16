/* globals RecordRTC:true */

(function (angular) {

    'use strict';

    var module = angular.module('ng.cx.recorder', ['ng.cx.recorder.templates', 'ng.cx.ua']);

    /**
     * Constraints used to capture and record media. it is user by userMedia and SingleMedia
     **/
    var MEDIA_CONSTRAINTS = {
        video: {
            // camera constraints
            capture: {
                video: {
                    mandatory: {
                        maxWidth: 640,
                        maxHeight: 480,
                        minWidth: 640,
                        minHeight: 480
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
        },
        multiple: {
            video: true,
            audio: true
        }
    };

    var MEDIA_TYPE = {
        audio: 'audio',
        video: 'video',
        multiple: 'multiple'
    };

    var MEDIA_STATE = {
        disabled: 'disabled',
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
     *      <p>provides a way to get the streams from the camera and / or the microphone.</p>
     *      <p>The service shims navigator.getUserMedia to make it work in all browsers and handles error if getUserMedia is not supported.</p>
     **/
    module.service('userMedia', [
        '$q',
        '$window',
        function ($q, $window) {

            // interface for the user agent, it will provide the ways to access the camera and the microphne
            var navigator = $window.navigator;

            var constraints = {
                audio: MEDIA_CONSTRAINTS.audio.capture,
                video: MEDIA_CONSTRAINTS.video.capture,
                multiple: MEDIA_CONSTRAINTS.multiple
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
             **/
            function getMedia(constraints) {
                var dfd = $q.defer();
                var stream;

                if (!navigator.getMedia) {
                    console.log('capturing constraints ', constraints);
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
             * Asks the user to use the camera and/or the microphone and returns a promise providing the stream and an URL object where the stream
             * will be used.
             *
             * <p>If the user grant permission to use the device it will resolve the deferred object returned.</p>
             * <p>If the user rejects : the deferred object will be rejected</p>
             *
             * <p>If the browser does not allow to request the use of the media devices: the deferred object will be rejected.</p>
             *
             * @param {String} type
             * Indicates the type of media to be captured, it can be : <ul><li>'audio'</li><li>'video'</li><li>'multiple'</li><ul>
             *
             * @returns {Object}
             * <p> A promise which will be resolved when the user grant the access to the camera / microphone. </p>
             * <p> the promise will resolve an object with the stream and the url Object to retrieve the stream </p>
             * ```
             * {
             *    source: the stream,
             *    url: the url where the browser can fetch the stream
             * }
             * ```
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
        '$rootScope',
        '$q',
        'userMedia',
        function singleMediaFactory($rootScope, $q, userMedia) {

            var SingleMedia = function (element, sourceUrl, multipleStreamCapturingSupported) {

                // --------------------- PROPERTIES
                var _type;
                var _constraints;
                var _stream;
                var _streamUrl;
                var _element;
                var _blobUrl;
                var _recorder;
                var _capturingEnabled = false;
                var _state = MEDIA_STATE.disabled;

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
                        _element.src = _streamUrl;
                        _element.volume = 0;
                        _element.play();
                        _state = MEDIA_STATE.capturing;

                        dfd.resolve(_streamUrl);

                    } else {
                        userMedia.getMedia(_type).then(function (stream) {
                            _stream = stream.source;
                            _streamUrl = stream.url;
                            _element.src = _streamUrl;
                            _element.play();
                            _capturingEnabled = true;
                            _state = MEDIA_STATE.capturing;
                            dfd.resolve(stream);
                        });
                    }

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
                    });

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
                    }

                    _element.currentTime = 0;
                    _element.pause();

                    _state = MEDIA_STATE.stopped;
                }

                function removeRecording() {
                    capture();
                }

                function handleMediaTimeUpdate() {
                    $rootScope.$evalAsync();
                }

                function handleLoadedData() {
                    $rootScope.$evalAsync();
                }

                function mediaEnededHandler() {
                    stop();
                    $rootScope.$evalAsync();
                }

                function init() {

                    _type = (multipleStreamCapturingSupported) ? 'multiple' : element.tagName.toLowerCase();

                    if (MEDIA_TYPE.hasOwnProperty(_type)) {

                        _constraints = MEDIA_CONSTRAINTS[_type];

                        _element = element;
                        _element.autoplay = false;
                        _element.volume = 0;

                        _element.addEventListener('timeupdate', handleMediaTimeUpdate);
                        _element.addEventListener('ended', mediaEnededHandler);
                        _element.addEventListener('loadeddata', handleLoadedData);

                        if (sourceUrl) {
                            _element.src = sourceUrl;
                        } else {
                            capture().then(function (stream) {
                                _recorder = new RecordRTC(stream.source, _constraints.record);
                            });
                        }

                    } else {
                        throw new Error('SingleMedia factory Error: type : ' + _type + ' is not supported as media element');
                    }

                }

                // --------------------- METHODS

                this.play = play;
                this.stop = stop;
                this.pause = pause;
                this.record = record;
                this.capture = capture;
                this.stopStream = stopStream;
                this.removeRecording = removeRecording;

                Object.defineProperty(this, 'hasRecording', {
                    get: function () {
                        return (!!_blobUrl);
                    }
                });

                Object.defineProperty(this, 'isCapturingEnabled', {
                    get: function () {
                        return _capturingEnabled;
                    }
                });

                Object.defineProperty(this, 'state', {
                    get: function () {
                        return _state;
                    }
                });

                Object.defineProperty(this, 'currentTime', {
                    get: function () {
                        return _element.currentTime;
                    },
                    set: function (time) {
                        _element.currentTime = time;
                    }
                });

                Object.defineProperty(this, 'duration', {
                    get: function () {
                        return _element.duration;
                    }
                });

                Object.defineProperty(this, 'muted', {
                    get: function () {
                        return _element.muted || false;
                    },
                    set: function (value) {
                        _element.muted = value;
                    }
                });

                init();

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
        function mediaHandlerFactory($interval, SingleMedia) {

            // constructor
            var MediaHandler = function () {

                var mediaObjects = [];

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
                function addMediaElement(element, sourceUrl, multipleStreamCapturingSupported) {
                    mediaObjects.push(new SingleMedia(element, sourceUrl, multipleStreamCapturingSupported));
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
                }

                /**
                 * @ngdoc function
                 * @name record
                 * @methodOf ng.cx.recorder.MediaHandler
                 *
                 * @description
                 * Start recording
                 **/
                var interval;
                var recordedTime;
                var maxRecordingSeconds;

                function record() {
                    mediaObjects.forEach(function (media) {
                        media.record();
                    });

                    recordedTime = 0;
                    interval = $interval(function () {
                        if (recordedTime === maxRecordingSeconds) {
                            stop();
                        } else {
                            recordedTime++;
                        }

                    }, 1000);
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

                    if (interval) {
                        $interval.cancel(interval);
                    }
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
                }

                function removeRecording() {
                    mediaObjects.forEach(function (media) {
                        media.removeRecording();
                    });
                }

                function getState() {

                    if (mediaObjects && mediaObjects[0]) {
                        return mediaObjects[0].state;
                    }
                    return undefined;

                }

                /**
                 *  stop --> record --> paused --> playing
                 *                        ^           |
                 *                        |           v
                 *                         -----------
                 */
                function goToNexStep() {
                    var state = getState();
                    switch (state) {
                    case MEDIA_STATE.capturing: // stopped -> record;
                        record();
                        break;
                    case MEDIA_STATE.recording: // record -> stop;
                        stop();
                        break;
                    case MEDIA_STATE.paused: // stop -> play;
                        play();
                        break;
                    case MEDIA_STATE.stopped: // stop -> play;
                        play();
                        break;
                    case MEDIA_STATE.playing: // play -> pause;
                        pause();
                        break;
                    }
                }

                this.addMediaElement = addMediaElement;
                this.stopStream = stopStream;
                this.goToNexStep = goToNexStep;
                this.removeRecording = removeRecording;
                this.stop = stop;
                this.pause = pause;
                this.play = play;

                Object.defineProperty(this, 'state', {
                    get: getState
                });

                Object.defineProperty(this, 'duration', {
                    get: function () {
                        var time = 0;

                        if (getState() === MEDIA_STATE.recording) {
                            time = recordedTime;
                        } else if (mediaObjects[0]) {
                            time = mediaObjects[0].duration;
                        }

                        return time;
                    }
                });

                Object.defineProperty(this, 'currentTime', {
                    get: function () {
                        var time = 0;
                        if (getState() === MEDIA_STATE.recording) {
                            time = recordedTime;
                        } else if (mediaObjects[0]) {
                            time = mediaObjects[0].currentTime;
                        }
                        return time;
                    },
                    set: function (value) {
                        for (var ix = 0; ix < mediaObjects.length; ix++) {
                            mediaObjects[ix].currentTime = value;
                        }
                    }
                });

                Object.defineProperty(this, 'isCapturingEnabled', {
                    get: function () {
                        for (var ix = 0; ix < mediaObjects.length; ix++) {
                            if (!mediaObjects[ix].isCapturingEnabled) {
                                return false;
                            }
                        }
                        return true;
                    }
                });

                Object.defineProperty(this, 'maxRecordingSeconds', {
                    get: function () {
                        return maxRecordingSeconds;
                    },
                    set: function (value) {
                        maxRecordingSeconds = value;
                    }
                });

                Object.defineProperty(this, 'muted', {
                    get: function () {
                        return (mediaObjects[0]) ? mediaObjects[0] : false;
                    },
                    set: function (value) {
                        for (var ix = 0; ix < mediaObjects.length; ix++) {
                            mediaObjects[ix].muted = value;
                        }
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
        'cxUA',
        'MediaHandler',
        function recorderControls($rootScope, cxUA, MediaHandler) {

            return {
                restrict: 'A',
                templateUrl: 'lib/ng.cx.recorder/ng.cx.recorder.tpl.html',
                replace: 'element',
                scope: {
                    videoElement: '=',
                    audioElement: '=',
                    videoUrl: '=',
                    audioUrl: '=',
                    minified: '=',
                    registerControlsApi: '=',
                    maxRecordingTime: '=',
                    muted: '=',
                    includeAudio: '='
                },
                link: function ($scope, $element) {

                    function addMediaElements() {

                        if (cxUA.isFirefox) {
                            if (!!$scope.videoElement) {
                                if (!!$scope.includeAudio) {
                                    $scope.mediaHandler.addMediaElement($scope.videoElement, $scope.videoUrl, true);
                                } else {
                                    $scope.mediaHandler.addMediaElement($scope.videoElement, $scope.videoUrl);
                                }
                            }
                        } else {
                            if (!!$scope.includeAudio) {
                                $scope.mediaHandler.addMediaElement(angular.element('<audio>')[0], $scope.audioUrl);
                            }
                            if (!!$scope.videoElement) {
                                $scope.mediaHandler.addMediaElement($scope.videoElement, $scope.videoUrl);
                            }
                        }
                    }

                    /**
                     * Initialization of the directive
                     **/
                    function init() {
                        $scope.mediaHandler = new MediaHandler();
                        $scope.mediaHandler.maxRecordingSeconds = $scope.maxDuration;
                        $scope.$evalAsync(addMediaElements);

                        if ($scope.registerControlsApi) {
                            $scope.registerControlsApi({
                                record: $scope.mediaHandler.record,
                                play: $scope.mediaHandler.play,
                                stop: $scope.mediaHandler.stop
                            });
                        }
                    }

                    $scope.$watch('muted', function (value) {
                        $scope.mediaHandler.muted = value;
                    });

                    $scope.MEDIA_STATE = MEDIA_STATE;
                    $scope.maxDuration = $scope.maxRecordingTime || 120;

                    $scope.rangeHandlers = {
                        mouseDown: function () {
                            $scope.time.trackingEnabled = false;
                            $scope.mediaHandler.pause();
                        },
                        mouseUp: function () {
                            $scope.time.trackingEnabled = true;
                        },
                        change: function () {
                            $scope.mediaHandler.currentTime = $scope.time.unformatted;
                        }
                    };

                    $scope.time = {
                        trackingEnabled: true,
                        unformatted: 0,
                        formatted: new Date(null)
                    };

                    $scope.$watch('mediaHandler.currentTime', function (value) {

                        if ($scope.time.trackingEnabled) {
                            $scope.time.unformatted = value;
                        }

                        $scope.time.formatted.setSeconds(value);

                    });

                    /**
                     * when the tool is removed it stops capturing video and audio
                     */
                    $scope.$on('$destroy', function () {
                        $scope.mediaHandler.stop();
                        $scope.mediaHandler.stopStream();
                    });

                    init();

                }
            };
        }
    ]);

})(angular);

