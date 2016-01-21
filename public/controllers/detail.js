angular.module('MyApp')
  .controller('DetailCtrl', ['$tooltip', '$compile', 'uiCalendarConfig', '$scope', '$rootScope', '$routeParams', 'Show', 'Subscription', '$resource', '$timeout',
    function($tooltip, $compile, uiCalendarConfig, $scope, $rootScope, $routeParams, Show, Subscription, $resource, $timeout) {
      var disqus_shortname = 'showtrackr';
    
      // load disqus comments
      (function() {
          var dsq = document.createElement('script'); dsq.type = 'text/javascript'; dsq.async = true;
          dsq.src = '//' + disqus_shortname + '.disqus.com/embed.js';
          (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(dsq);
      })();

      var initializeArray = function(episodes) {
        var seasonsArray = [], currentSeason, events = [];
        $scope.uiConfig = {
          calendar:{
            height: 450,
            header:{
              left: 'month agendaWeek agendaDay',
              center: 'title',
              right: 'today prev,next'
            },
            eventRender: $scope.eventRender,
            eventLimit: 7,
            defaultDate: new Date(episodes[episodes.length-1].firstAired)
          }
        };
        if($scope.nextEpisode)
          $scope.uiConfig.calendar.defaultDate = new Date($scope.nextEpisode.firstAired);

        _.forEach(episodes, function(episode) {
          if(episode.firstAired) {
            var firstAired = episode.firstAired.substr(0, episode.firstAired.indexOf('T'));
            var date = Date.create(firstAired + ' ' + $scope.show.airsTime); 
            events.push({
              title: episode.episodeName || 'No title yet',
              start: date,
              end: angular.copy(date).advance({minutes: $scope.show.runtime}),
              season: episode.season
            });
          }

          if(currentSeason !== episode.season) {
            currentSeason = episode.season;
            seasonsArray.push(currentSeason);
          }
        });
        $scope.eventSources = [events];
        return seasonsArray;
      };

      $scope.eventRender = function(event, element, view) { 
        $tooltip(element, {title: 'Season ' + event.season + ' - ' + event.title});
      };

      var startSocketIO = function() {
        var socket = io('http://localhost:9090');
        socket.on('connect', function() {
          $scope.tweetsResult = [];
          console.log('we are connected');
        });

        socket.on('tweet', function(tweet) {
          $timeout(function() {
            if($scope.loadingTweets) $scope.loadingTweets = null;
            $scope.tweetsResult = tweet.concat($scope.tweetsResult); 
            //$scope.tweetsResult = _.uniq($scope.tweetsResult);
          });
          $timeout(function() {
            twttr.widgets.load();
          });
        });
      };

      $scope.fetching = true;

      Show.get({ _id: $routeParams.id }, function(show) {
        $scope.show = show; 

        if($scope.show.episodes) {
          //startSocketIO();
          $scope.getTimeline(show.name);
          $scope.nextEpisode = show.episodes.filter(function(episode) {
            return new Date(episode.firstAired) > new Date();
          })[0];

          var firstSeason = $scope.show.episodes[0].season;
          $scope.seasons = initializeArray(show.episodes);

          $scope.changeContent(firstSeason);
          $('#poster').on('load', function() {
            $('#poster').elevateZoom();
          });
        }
        $scope.fetching = false;
      }, function(err) {
        $scope.fetching = false;
      });

      $scope.showCalendar = function() {
        $timeout(function() {
          if($('.fc-view').is(':empty'))
            $('.fc-month-button').trigger('click');
        },200);
      };

      $scope.changeContent = function(season, event) {
        if(event) event.preventDefault();
        $scope.episodes = _.where($scope.show.episodes, {season: season});
      };

      $scope.isSubscribed = function() {
        return $scope.show.subscribers.indexOf($rootScope.currentUser._id) !== -1;
      };

      $scope.subscribe = function() {
        Subscription.subscribe($scope.show).success(function() {
          $scope.show.subscribers.push($rootScope.currentUser._id);
        });
      };

      $scope.unsubscribe = function() {
        Subscription.unsubscribe($scope.show).success(function() {
          var index = $scope.show.subscribers.indexOf($rootScope.currentUser._id);
          $scope.show.subscribers.splice(index, 1);
        });
      };

      $scope.getTimeline = function(showName) {
        $scope.hashtag = '#' + showName;
        $scope.hashtag = $scope.hashtag.replace(/ /g,'');
        $scope.tweetsResult = [];

        // initiate masonry.js
        // $scope.msnry = new Masonry('#tweet-list', {
        //   columnWidth: 320,
        //   itemSelector: '.tweet-item',
        //   transitionDuration: 0,
        //   isFitWidth: true
        // });

        // // layout masonry.js on widgets.js loaded event
        // twttr.events.bind('loaded', function () {
        //   $scope.msnry.reloadItems();
        //   $scope.msnry.layout();
        // });

        $scope.getTweets($scope.hashtag);
      };

    // requests and processes tweet data
    var getTweets = function(hashtag, paging) {
      $scope.loadingTweets = 'loading ...';
      var params = {
        hashtag: hashtag
      };

      if($scope.maxId) {
        params.max_id = $scope.maxId;
      }

      // create Tweet data resource
      $scope.tweets = $resource('/twitter/search/:hashtag', params);

      // GET request using the resource
      $scope.tweets.query({}, function(res) { 
        if(angular.isUndefined(paging) ) {
          $scope.tweetsResult = [];
        }

       $scope.tweetsResult = $scope.tweetsResult.concat(res); console.log(res);
       $scope.tweetsResult = _.uniq($scope.tweetsResult);

        // for paging - https://dev.twitter.com/docs/working-with-timelines
        $scope.maxId = res[res.length - 1].id;

        // render tweets with widgets.js
        $timeout(function() {
          twttr.widgets.load();
          $scope.loadingTweets = null;
        }, 30);
      }, function(err) {
         console.log(err);
         $scope.loadingTweets = null;
      });
    };

    $scope.getTweets = function(hashtag) {
      $scope.maxId = undefined;
      getTweets(hashtag);
    };

    // binded to 'Get More Tweets' button
    $scope.getMoreTweets = function(hashtag) {
      getTweets(hashtag, true);
    };
  }]);