(function() {

	//	Set your parametres here
	var URL = 'https://api.massrelevance.com/jmskey/ema-instagram-video.json',	// Url of your stream
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

	var PostsQueue = Backbone.Collection.extend({});

	var WidgetView = Backbone.View.extend({
		el: '#MRWidget',
		template: _.template($('#MRWidgetTemplate').html()),

		initialize: function() {		
			this.currentPost = window.sessionStorage.mrWingetCurrPost || 0;
			this.postsCount = this.collection.length;
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
			//this.currentPost++;
			window.sessionStorage.mrWingetCurrPost = this.currentPost++;
			this.render(this.currentPost, true);			
			if(this.currentPost === this.postsCount)
				this.currentPost = 0;
				//return;
			setTimeout(this.startRefreshing.bind(this), REFRESH_INTERVAL);
		},

		render: function(postID, isAnimated) {
			//First set fresh time
			var model = this.collection.get('c' + postID);
			model.set('time', parseDate(model.get('rawTime')));
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
		}
	});

	//	Create array of models
	var parseResponse = function(rawJSON) {
		var rawPosts = JSON.parse(rawJSON),
			posts = [];

		rawPosts.forEach(function(element) {
			if(element.network === 'twitter') {
				posts.push(createTwitterModel(element));
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

	var dateConstants = {
		msInDay: 86400000,
		msInHour: 3600000,
		msInMinute: 60000,
		monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Nov', 'Dec']
	};

	var parseDate = function(rawDate) {
		var postTime = (new Date(rawDate)).getTime(),
			currentTime = (new Date).getTime(),			
			timestamp = null;

		if((currentTime - postTime) <= dateConstants.msInDay) {
			var msAgo = currentTime - postTime,
				hoursAgo = Math.floor(msAgo / dateConstants.msInHour);
			timestamp = hoursAgo > 0 ? (hoursAgo + (hoursAgo > 1 ? ' hours' : ' hour') + ' ago') : (Math.ceil(msAgo / dateConstants.msInMinute) + ' min ago');
		} else {
			var postDate = new Date(postTime);
			timestamp = dateConstants.monthNames[postDate.getMonth()] + ' ' + postDate.getDate() + ', ' + postDate.getFullYear();
		}
		return timestamp;		
	};

	var prefix = URL.indexOf('https') === 0 ? 'https' : 'http';
	//	Widget start point 
	var createQueue = (function () {
		if(window.sessionStorage.mrWidgetStream === undefined) {
			var xhr = new XMLHttpRequest();
				xhr.onload = function() {
					if(this.status === 200 && this.responseText.length !== 0) {
						var	postsQueue = new PostsQueue(parseResponse(this.responseText)),
						appView = new WidgetView({collection: postsQueue});

						window.sessionStorage.mrWidgetStream = this.responseText;
					} else {
						$('#MRWidget').html('Sorry, some kind of error has occurred<br>' + this.status + ' ' + this.statusText);
					}
				};
			xhr.open('GET', URL, true);
			xhr.send();
		} else {
			var	postsQueue = new PostsQueue(parseResponse(window.sessionStorage.mrWidgetStream)),
			appView = new WidgetView({collection: postsQueue});
		}
	})();
})();