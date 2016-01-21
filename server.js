var mongoose = require('mongoose');
var relationship = require("mongoose-relationship");
var bcrypt = require('bcryptjs');

var showSchema = new mongoose.Schema({
  _id: Number,
  name: String,
  airsDayOfWeek: String,
  airsTime: String,
  firstAired: Date,
  genre: [String],
  network: String,
  overview: String,
  rating: Number,
  runtime: Number,
  ratingCount: Number,
  status: String,
  poster: String,
  subscribers: [{
    type: mongoose.Schema.Types.ObjectId, ref: 'User', childPath: 'shows' 
  }],
  episodes: [{
    season: Number,
    episodeNumber: Number,
    episodeName: String,
    firstAired: Date,
    overview: String
  }]
});
showSchema.plugin(relationship, { relationshipPathName: 'subscribers' });

var userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  shows: [{
    type: Number, ref: 'Show'
  }]
});

userSchema.pre('save', function(next) {
  var user = this;
  if (!user.isModified('password')) return next();
  bcrypt.genSalt(10, function(err, salt) {
    if (err) return next(err);
    bcrypt.hash(user.password, salt, function(err, hash) {
      if (err) return next(err);
      user.password = hash;
      next();
    });
  });
});

userSchema.methods.comparePassword = function(candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, function(err, isMatch) {
    if (err) return cb(err);
    cb(null, isMatch);
  });
};

var User = mongoose.model('User', userSchema);
var Show = mongoose.model('Show', showSchema);
mongoose.connect('localhost');

var express = require('express');
var path = require('path');
var compress = require('compression');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var async = require('async');
var request = require('request');
var xml2js = require('xml2js');
var _ = require('lodash');
var session = require('express-session');
var mongoStore = require('connect-mongo')({session: session});
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var agenda = require('agenda')({ db: { address: 'localhost:27017/test' } });
var sugar = require('sugar');
var nodemailer = require('nodemailer');
var io = require('socket.io')(9090);

var app = express();

passport.serializeUser(function(user, done) { console.log('---serializer', user.id);
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {console.log('---deserializer---', user);
    done(err, user);
  });
});

passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done) { console.log('----localstrategy');
  User.findOne({ email: email }).populate('shows').exec(function(err, user) {
    if (err) return done(err);
    if (!user) return done(null, false);
    user.comparePassword(password, function(err, isMatch) {
      if (err) return done(err);
      if (isMatch) return done(null, user);
      return done(null, false);
    });
  });
}));

app.set('port', process.env.PORT || 4000);
app.use(compress());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({ 
  secret: 'keyboard cat', 
  resave: false, 
  saveUninitialized: false,
  store: new mongoStore({
    db: 'mongodb://localhost/test',
    collection: 'sessions'
  })
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 86400000 }));

app.use(function(req, res, next) { 
  if(req.user) {
    res.cookie('user', JSON.stringify(req.user)); 
  }
  res.cookie('apiKey', 'AD25A0B44ABA8F9B');
  next();
}); 

function ensureAuthenticated(req, res, next) { 
  if(req.isAuthenticated()) next();
  else res.send(401);
}

var apiKey = 'AD25A0B44ABA8F9B';
var parser = xml2js.Parser({
  explicitArray: false,
  normalizeTags: true
});

app.get('/*', function(req, res, next) {
  var apiRouteMatch = /api\/*/.test(req.url); 
  var searchShowRouteMatch = /search\/*/.test(req.url);
  var tweetsRouteMatch = /twitter\/*/.test(req.url);
  if(!apiRouteMatch && !searchShowRouteMatch && !tweetsRouteMatch) {  
    return res.sendFile('index.html', {root:'./public'}); 
  }
  next();
});

app.get('/search/:showName', function(req, res, next) {
  var url = 'http://thetvdb.com/api/GetSeries.php?seriesname=' + req.params.showName;
  request.get(url, function(error, response, body) { 
    if(error) {
      return res.status(400).send(error);
    } else {
      parser.parseString(body, function(err, result) {
        if(!result.data.series) {
          return res.status(400).send({ message: req.body.showName + ' was not found.' });
        }
        res.status(200).send(result.data.series);
      });
    }
  });
});

app.get('/api/shows', function(req, res, next) {
  var query = Show.find();
  if(req.query.genre) {
    query.where({ genre: req.query.genre });
  } else if(req.query.alphabet) {
    query.where({ name: new RegExp('^' + '[' + req.query.alphabet + ']', 'i') });
  } else {
    query.limit(12);
  }
  query.exec(function(err, shows) {
    if(err) return next(err); 
    res.send(shows);
  });
});

app.get('/api/shows/:id', function(req, res, next) {
  Show.findById(req.params.id, function(err, show) {
    if(err) return next(err);
    res.send(show);
  });
});

app.post('/api/shows', function(req, res, next) { 
  async.waterfall([
    function(callback) {
      var seriesId = req.body.id;
      request.get('http://thetvdb.com/api/' + apiKey + '/series/' + seriesId + '/all/en.xml', function(error, response, body) {
        if(error) return next(error);
        parser.parseString(body, function(err, result) {
          var series = result.data.series;
          var episodes = result.data.episode;
          var show = new Show({
            _id: series.id,
            name: series.seriesname,
            airsDayOfWeek: series.airs_dayofweek,
            airsTime: series.airs_time,
            firstAired: series.firstaired,
            genre: series.genre.split('|').filter(Boolean),
            network: series.network,
            overview: series.overview,
            rating: series.rating,
            ratingCount: series.ratingcount,
            runtime: series.runtime,
            status: series.status,
            poster: 'http://thetvdb.com/banners/' + series.poster,
            episodes: []
          });
          _.each(episodes, function(episode) {
            show.episodes.push({
              season: episode.seasonnumber,
              episodeNumber: episode.episodenumber,
              episodeName: episode.episodename,
              firstAired: episode.firstaired,
              overview: episode.overview
            });
          });
          callback(err, show);
        });
      });
    }
    // function(show, callback) {
    //   var url = 'http://thetvdb.com/banners/' + show.poster;
    //   request({ url: url, encoding: null }, function(error, response, body) {
    //     show.poster = 'data:' + response.headers['content-type'] + ';base64,' + body.toString('base64');
    //     callback(error, show);
    //   });
    // }
  ], function(err, show) {
    if(err) return next(err);
    show.save(function(err) {
      if(err) {
        if(err.code == 11000) {
          return res.send(409, { message: show.name + ' already exists.' });
        }
        return next(err);
      }
      var alertDate = Date.create('Next ' + show.airsDayOfWeek + ' at ' + show.airsTime).rewind({ hour: 2});
      agenda.schedule(alertDate, 'send email alert', show.name).repeatEvery('1 week');
      res.sendStatus(200);
    });
  });
});

app.get('/api/users/:id', function(req, res, next) {
  User.findOne({_id: req.params.id}).populate('shows').exec(function(err, user) {
    if (err) return next(err);
    if (!user) return next(new Error('Failed to load User ' + id));
    res.status(200).send(user);
  });
});

app.post('/api/login', passport.authenticate('local'), function(req, res) {console.log('--apilogin--', req.user);
  res.cookie('user', JSON.stringify(req.user));
  res.send(req.user);
});

app.post('/api/signup', function(req, res, next) {
  var user = new User({
    email: req.body.email,
    password: req.body.password
  });
  
  user.save(function(err) {
    if(err) return next(err);
    res.send(200);
  });
});

app.get('/api/logout', function(req, res, next) { 
  req.logout();
  res.send(200);
});

app.post('/api/subscribe', ensureAuthenticated, function(req, res, next) {
  Show.findById(req.body.showId, function(err, show) {
    if(err) return next(err);
    show.subscribers.push(req.user.id);
    show.save(function(err) {
      if(err) return next(err);
      res.send(200);
    });
  });
});

var Twit = require('twit');
var twitter = new Twit({
  consumer_key: 'XGplQLSm2i6QgPTCghJNUOeWY',  
  consumer_secret: '92u0i1PkN0GOlrNHpSMt8kE0bdGTEjxn9BhXpG5PETB8bqJcvC',
  access_token: '2615141678-a8rXmbBL0HpudgWv6Qcnk4M3x0UsQOc5PPYJlNM',
  access_token_secret: 'oMROxiTLMOOg37fBv2Ii0cThw0EL05Trdc20tVkl2o6gl'
});

var tweetCount = 15;
// requests the oEmbed html
var getOEmbed = function(tweet, tweets, oEmbedTweets, res) { 
  // oEmbed request params
  var params = {
    id: tweet.id_str,
    maxwidth: 300,
    hide_thread: true,
    omit_script: true,
    align: 'center'
  };

  // request data 
  twitter.get('statuses/oembed', params, function (err, data, resp) {
    console.log(err, data);
    if(data) {
      tweet.oEmbed = data; 
      oEmbedTweets.push(tweet); 
      //io.sockets.emit('tweet', [tweet]);
    }

    // do we have oEmbed HTML for all Tweets?
    if(oEmbedTweets.length === tweets.length) {
      res.json(oEmbedTweets); 
    }
  });
};

var stream;
app.get('/twitter/search/:hashtag', function(req, res) { 
  var tweets = [], oEmbedTweets = []; console.log('here');
  var params = {
    result_type: 'recent',
    q: req.params.hashtag, // the user id passed in as part of the route
    count: tweetCount // how many tweets to return
  };
  
  // the max_id is passed in via a query string param
  if(req.query.max_id) {
    params.max_id = req.query.max_id;
  }
  // if(stream) stream.stop();

  // var count = 0;
  // stream = twitter.stream('statuses/filter', {track: params.q});
  // stream.on('tweet', function(tweet) {
  //   //console.log(tweet);
  //   //for(var i = 0; i < tweets.length; i++) {
  //     getOEmbed(tweet, tweets, oEmbedTweets, res); 
  //     if(!count) {
  //       count+=1;
  //       res.send([]);
  //     }
  //   //}
  // });
 
  // stream.on('error', function(error) {
  //   console.log(error);
  //   res.status(500).send(error);
  // });
  twitter.get('search/tweets', params, function (err, data, resp) { console.log(err, data);
    if(err) {
      res.status(400).send(err);
    } else {
      tweets = data.statuses; 
      if(!tweets.length) {
        res.json(tweets);
      } else {
        for(var i = 0; i < tweets.length; i++) {
          getOEmbed(tweets[i], tweets, oEmbedTweets, res); 
        }
      }
    }
  });
});

// var nbOpenSockets = 0;
// io.sockets.on('connection', function(socket) {
//   console.log('Client connected !');
//   if(nbOpenSockets <= 0) {
//     nbOpenSockets = 0;
//     console.log('First active client. Start streaming from Twitter');
//     socket.emit('connect');
//   }
//   nbOpenSockets++;

//   socket.on('disconnect', function() {
//     console.log('Client disconnected !');
//     nbOpenSockets--;

//     if(nbOpenSockets <= 0) {
//       nbOpenSockets = 0;
//       console.log("No active client. Stop streaming from Twitter");
//       if(stream) stream.stop();
//     }
//   });
// });

app.post('/api/unsubscribe', ensureAuthenticated, function(req, res, next) {
  Show.findById(req.body.showId, function(err, show) { console.log(show);
    if (err) return next(err);
    var index = show.subscribers.indexOf(req.user.id);
    show.subscribers.splice(index, 1);
    show.save(function(err) {
      if (err) return next(err);
      res.send(200);
    });
  });
});

app.get('*', function(req, res) {
  res.redirect('/#' + req.originalUrl);
});

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.send(500, { message: err.message });
});

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

agenda.define('send email alert', function(job, done) {
  Show.findOne({ name: job.attrs.data }).populate('subscribers').exec(function(err, show) {
    var emails = show.subscribers.map(function(user) {
      return user.email;
    });

    var upcomingEpisode = show.episodes.filter(function(episode) {
      return new Date(episode.firstAired) > new Date();
    })[0];

    if(upcomingEpisode) {
      mailgun = require('mailgun-js')({
        apiKey: 'key-0039538c57a3d4991b1ea8b4946087c2',
        domain: 'sandboxfd572477ab074a2181edc6ada4e4cba3.mailgun.org'
      });

      var emailMsg = {
        from: 'Fred Foo ✔ <foo@blurdybloop.com>',
        to: emails.join(','),
        subject: show.name + ' is starting soon!',
        text: show.name + ' starts in less than 2 hours on ' + show.network + '.\n\n' +
          'Episode ' + upcomingEpisode.episodeNumber + ' Overview\n\n' + upcomingEpisode.overview
      };

      mailgun.messages().send(emailMsg, function(error, body) {
        console.log('Message sent: ' + body.message);
      });
    }
  });
});

agenda.start();

agenda.on('start', function(job) {
  console.log("Job %s starting", job.attrs.name);
});

agenda.on('complete', function(job) {
  console.log("Job %s finished", job.attrs.name);
});