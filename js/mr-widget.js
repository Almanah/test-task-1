(function() {

	//	Set your parametres here
	var URL = 'http://api.massrelevance.com/jmskey/vmn.json',	// Url of your stream
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
			this.currentPost = 0;
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
			this.currentPost++;
			this.render(this.currentPost, true);			
			if(this.currentPost === this.postsCount)
				return;
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

	//
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
			userUrl: 'http://twitter.com/' + newPost.get('userName'),
			postUrl: 'http://twitter.com/' + newPost.get('userName') + '/status/' + element.id_str,
			rawTime: element.created_at,
			counts: {
				favorites: {
					value: element.favorite_count,
					imageSrc: 'https://si0.twimg.com/images/dev/cms/intents/icons/favorite_hover.png'
				},
				retweets: {
					value: element.retweet_count,
					imageSrc: 'https://si0.twimg.com/images/dev/cms/intents/icons/retweet_hover.png'
				}
			}
		});

		//Check vine or not
		if(expandedURL.indexOf('vine.co/v/') !== -1) {				
			var url = 'http://api.embed.ly/1/oembed?url=' + expandedURL + '&height=230';
			getEmbedVideo(newPost, url);
			newPost.set('type', 'vine');
		} else {
			newPost.set({
				type: 'tweet',
				content: '<div class = "tweet">' + element.text + '</div>'
			});				
		}
		return newPost;
	};

	var createInstagramModel = function(element) {
		var newPost = new Post();

		newPost.set({
			type: element.type,
			rawTime: element.created_time * 1000,
			userName: element.user.username,
			userImage: element.user.profile_picture,
			userUrl: 'http://instagram.com/' + newPost.get('userName'),
			postUrl: element.link,
			counts: {
				likes: {
					value: element.likes.count,
					imageSrc: ''
				},
				comments: {
					value: element.comments.count,
					imageSrc: ''
				}
			}
		});
		//	Check type of post
		if(newPost.get('type') === 'image') {
			newPost.set('content', '<a href = "' + newPost.get('postUrl') + '" target = "_blank"><img src = "' + element.images.standard_resolution.url + '"></a>');
		} else {
			var videoUrl = element.link,
				url = 'http://api.embed.ly/1/oembed?url=' + videoUrl + '&height=230';
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
		console.log(postTime, currentTime, timestamp);
		return timestamp;		
	};

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