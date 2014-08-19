(function() {

	//	Set your parametres here
	var URL = 'https://api.massrelevance.com/jmskey/vmn.json',	// Url of your stream
		REFRESH_INTERVAL = 5000;	// Refresh time in milliseconds

	//Backbone logic
	var Post = Backbone.Model.extend({
		initialize: function() {
			this.set({
				content: '',
				counts: {}
			});
		}
	});

	var TwitterPost = Backbone.Model.extend({
		parse: function(data, options) {
			var	numOfUrls = data.entities.urls.length,
				expandedURL = numOfUrls > 0 ? data.entities.urls[numOfUrls - 1].expanded_url : '';

			this.userName = data.user.screen_name;
			this.userImage = data.user.profile_image_url;
			this.userUrl = 'http://twitter.com/' + data.user.screen_name;
			this.postUrl = 'http://twitter.com/' + data.user.screen_name + '/status/' + data.id_str;
			this.rawTime = data.created_at;
			this.counts = {
					favorites: data.favorite_count,
					retweets: data.retweet_count
			};
			//Check vine or not
			if(expandedURL.indexOf('vine.co/v/') !== -1) {
				var url = prefix + '://api.embed.ly/1/oembed?url=' + expandedURL + '&height=230';
				getEmbedVideo(this, url);
				this.type = 'vine';
			} else {
				this.type = 'tweet';
				this.content = '<div class = "tweet">' + parseTweet(data.text) + '</div>'				
			}
		}
	});

	var InstagramPost = Post.extend({

	});

	var PostsQueue = Backbone.Collection.extend({
		initialize: function() {

		}
	});

	var WidgetView = Backbone.View.extend({
		el: '#MRWidget',
		template: _.template($('#MRWidgetTemplate').html()),
		dateConstants: {
			msInYear: 31536000000,	// year is 365 days
			msInMonth: 2628000000,	// month is 1/12 of year
			msInWeek: 604800000,
			msInDay: 86400000,
			msInHour: 3600000,
			msInMinute: 60000,
			monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec']
		},

		initialize: function() {		
			this.currentPost = 0;
			this.postsCount = this.collection.length;
			//this.postsCount = 1;
			//	Need to rerender view if content of current post updates
			this.collection.on('change:content', (function(view) {
				return function(e) {
					if(e.cid === 'c' + view.currentPost) {
						view.render(view.currentPost, false);
					}
				}
			})(this));
			this.startRefreshing();
		},

		startRefreshing: function() {
			this.currentPost++;
			this.render(this.currentPost, true);			
			if(this.currentPost === this.postsCount)
				this.currentPost = 0;
				//return;
			setTimeout(this.startRefreshing.bind(this), REFRESH_INTERVAL);
		},

		render: function(postID, isAnimated) {
			//First set fresh time
			var model = this.collection.get('c' + postID);
			console.log(model);
			model.set('time', this.parseDate(model.get('rawTime')));
			console.log(model);
			//	Set animation for all posts except first or in case of updated content
			if(postID !== 1 && isAnimated) {
				this.$el.fadeOut('400', (function(view) {
					return function() {
						view.$el.html(view.template(view.collection.get('c' + postID).toJSON()));
						view.$el.fadeIn('400');
					}
				})(this));
			} else {
				this.$el.html(this.template(model.toJSON()));
			}
			return this;
		},

		parseDate: function(rawDate) {
			var postTime = (new Date(rawDate)).getTime(),
				currentTime = (new Date).getTime(),
				msAgo = currentTime - postTime,
				timestamp = '';
			if((msAgo / this.dateConstants.msInYear) >= 1) {
				var years = Math.floor(msAgo / this.dateConstants.msInYear);
				timestamp = years + (years > 1 ? ' years' : ' year');
			} else if((msAgo / this.dateConstants.msInMonth) >= 1) {
				var months = Math.floor(msAgo / this.dateConstants.msInMonth);
				timestamp = months + (months > 1 ? ' months' : ' month');
			} else if((msAgo / this.dateConstants.msInWeek) >= 1) {
				var weeks = Math.floor(msAgo / this.dateConstants.msInWeek);
				timestamp = weeks + (weeks > 1 ? ' weeks' : ' week');
			} else if((msAgo / this.dateConstants.msInDay) >= 1) {
				var days = Math.floor(msAgo / this.dateConstants.msInDay);
				timestamp = days + (days > 1 ? ' days' : ' day');
			} else if((msAgo / this.dateConstants.msInHour) >= 1) {
				var hours = Math.floor(msAgo / this.dateConstants.msInHour);
				timestamp = hours + (hours > 1 ? ' hours' : ' hour');
			} else if((msAgo / this.dateConstants.msInMinute) > 0) {
				var min = Math.ceil(msAgo / this.dateConstants.msInMinute);
				timestamp = min + ' min';
			} else {
				return 'Post link';	// save user's opportunity to link post if time is incorrect
			}
			return timestamp + ' ago';
		},

		embedContent: function(model) {
			var type = model.get('type');
			if(type === 'photo') {

			} else if(type === 'video') {

			} else if(type === 'tweet') {

			}
		}
	});

	//	Create array of models
	var parseResponse = function(rawJSON) {
		var rawPosts = JSON.parse(rawJSON),
			posts = [];

		rawPosts.forEach(function(element) {
			if(element.network === 'twitter') {
				posts.push(new TwitterPost(element));
			} else if(element.network === 'instagram') {
				posts.push(createInstagramModel(element));
			} else {
				console.log('Error');
			}
		});
		return posts;
	};

	var createTwitterModel = function(element) {
		var newPost = new Post(),
			numOfUrls = element.entities.urls.length,
			expandedURL = numOfUrls > 0 ? element.entities.urls[numOfUrls - 1].expanded_url : '';

		newPost.set({
			userName: element.user.screen_name,
			userImage: element.user.profile_image_url,
			userUrl: 'http://twitter.com/' + element.user.screen_name,
			postUrl: 'http://twitter.com/' + element.user.screen_name + '/status/' + element.id_str,
			rawTime: element.created_at,
			counts: {
				favorites: element.favorite_count,
				retweets: element.retweet_count
			}
		});
		//Check vine or not
		if(expandedURL.indexOf('vine.co/v/') !== -1) {				
			var url = prefix + '://api.embed.ly/1/oembed?url=' + expandedURL + '&height=230';
			getEmbedVideo(newPost, url);
			newPost.set('type', 'vine');
		} else {
			newPost.set({
				type: 'tweet',
				content: '<div class = "tweet">' + parseTweet(element.text) + '</div>'
			});				
		}
		return newPost;
	};

	//	Parse links in tweets
	var parseTweet = function(rawTweet) {
		var words = rawTweet.split(' '),
			tweet = '';

		words.forEach(function(word) {
			if((word.indexOf('http://') === 0 || word.indexOf('https://') === 0) && word.indexOf('…') === -1) {	// last indexOf check for unfinished link
				word = '<a href = "' + word +'" target = "_blank">' + word + '</a>';
			}
			tweet += (word + ' ');
		});
		return tweet;
	}

	var createInstagramModel = function(element) {
		var newPost = new Post();

		newPost.set({
			type: element.type,
			rawTime: element.created_time * 1000,
			userName: element.user.username,
			userImage: element.user.profile_picture,
			userUrl: 'http://instagram.com/' + element.user.username,
			postUrl: element.link,
			counts: {
				likes: element.likes.count,
				comments: element.comments.count					
			}
		});
		//	Check type of post
		if(newPost.get('type') === 'image') {
			newPost.set('content', '<a href = "' + newPost.get('postUrl') + '" target = "_blank"><img src = "' + element.images.standard_resolution.url + '"></a>');
		} else {
			var videoUrl = element.link,
				url = prefix + '://api.embed.ly/1/oembed?url=' + videoUrl + '&height=230';
			getEmbedVideo(newPost, url);
		}
		return newPost;
	};

	var getEmbedVideo = function(model, url) {
		var request = new XMLHttpRequest();

		request.onload = (function() {
			var post = model;
			return function() {
				if(this.status === 200)
					post.set('content', JSON.parse(this.responseText).html);
				else
					post.set('content', 'Sorry, some kind of error has occurred<br>' + this.status + ' ' + this.statusText);
			}
		})();
		request.open('GET', url, true);
		request.send();
	};

	var prefix = URL.indexOf('https') === 0 ? 'https' : 'http';
	//	Widget start point 
	var createQueue = (function () {
		var xhr = new XMLHttpRequest();
			xhr.onload = function() {
				if(this.status === 200 && this.responseText.length !== 0) {
					var	postsQueue = new PostsQueue(parseResponse(this.responseText)),
					appView = new WidgetView({collection: postsQueue});
				} else {
					$('#MRWidget').html('Sorry, some kind of error has occurred<br>' + this.status + ' ' + this.statusText);
				}
			};
		xhr.open('GET', URL, true);
		xhr.send();
	})();
})();