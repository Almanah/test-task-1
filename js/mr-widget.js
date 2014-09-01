(function() {

	//------	Set your parametres here	---------------------------------------------------------
	var URL = 'http://api.massrelevance.com/jmskey/vmn.json',	// Url of your stream
		REFRESH_INTERVAL = 5000;	// Refresh time in milliseconds
	//-----------------------------------------------------------------------------------------------

	var prefix = URL.indexOf('https') === 0 ? 'https' : 'http';
	// Backbone logic
	var TwitterPost = Backbone.Model.extend({
		parse: function(data, options) {
			var	numOfUrls = data.entities.urls.length,
				expandedURL = numOfUrls > 0 ? data.entities.urls[numOfUrls - 1].expanded_url : '',
				hash = {
					userName: data.user.screen_name,
		 			userImage: (prefix === 'http') ? data.user.profile_image_url : data.user.profile_image_url_https,
		 			userUrl: prefix + '://twitter.com/' + data.user.screen_name,
		 			postUrl: prefix + '://twitter.com/' + data.user.screen_name + '/status/' + data.id_str,
		 			rawTime: data.created_at,
		 			counts: {
		 				favorites: data.favorite_count,
		 				retweets: data.retweet_count
		 			}
				};
			// Check type of post
			if(expandedURL.indexOf('vine.co/v/') !== -1) {
				hash.type = 'video';
				hash.contentUrl = prefix + '://api.embed.ly/1/oembed?url=' + expandedURL + '&height=230';				
			} else if (data.entities.media !== undefined) {
				hash.type = 'image';
				hash.contentUrl = (prefix === 'http') ? data.entities.media[0].media_url : data.entities.media[0].media_url_https;								
			} else {
				hash.type = 'tweet';
				hash.contentUrl = data.text;	// Named property as Url for identical style
			}
			return hash;
		}
	});

	var InstagramPost = Backbone.Model.extend({
		parse: function(data, options) {
			var hash = {
				type: data.type,
	 			rawTime: data.created_time * 1000,
	 			userName: data.user.username,
	 			userImage: data.user.profile_picture.replace(/https|http/, prefix),
	 			userUrl: prefix + '://instagram.com/' + data.user.username,
	 			postUrl: data.link,
	 			counts: {
	 				likes: data.likes.count,
	 				comments: data.comments.count					
	 			}
			};
			if(hash.type === 'image') {
				hash.contentUrl = data.images.standard_resolution.url.replace(/https|http/, prefix);
			} else {
				hash.contentUrl = prefix + '://api.embed.ly/1/oembed?url=' + data.link + '&height=230';
			}
			return hash;
		}
	});

	var PostsQueue = Backbone.Collection.extend({
		url: URL,

		model: function(attr, options) {
			if(attr.network === 'twitter') {
				return new TwitterPost(attr, options);
			} else if(attr.network === 'instagram') {
				return new InstagramPost(attr, options);
			}
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
		},

		initialize: function() {
			this.nextContent = {};
			this.collection.on('end_fetch', this.prepareFirstPost.bind(this));
		},

		prepareFirstPost: function() {
			this.startPost = parseInt(this.collection.models[0].cid.slice(1), 10);	// Sometimes cid's start not from one
			this.currentPost = this.startPost;
			this.postsCount = this.collection.length + this.currentPost - 1;
			this.nextModel = this.collection.get('c' + this.currentPost);
			this.embedContent(this.nextModel, this.nextContent, false);		// Get first video synchronicaly
			this.startRefreshing();
		},

		startRefreshing: function() {
			this.currentModel = this.nextModel;
			this.currentContent = this.nextContent;	
			this.render(this.currentModel, this.currentContent);
			this.currentPost++;
			if(this.currentPost === this.postsCount) {
				this.currentPost = this.startPost;
			}
			//	Preload new content
			this.nextModel = this.collection.get('c' + this.currentPost);
			this.embedContent(this.nextModel, this.nextContent, true);
			setTimeout(this.startRefreshing.bind(this), REFRESH_INTERVAL);
		},

		render: function(model, viewContent) {
			var time = this.parseDate(model.get('rawTime'));		
			//	Set animation for all posts except first 
			if(this.currentPost !== this.startPost) {
				this.$el.fadeOut('400', (function(view, model, content, time) {
					return function() {
						view.$el.html(view.template({
							model: model.toJSON(),
							view: {
								content: content || '',
								time: time
							}
						}));
						view.$el.fadeIn('400');
					}
				})(this, model, viewContent.content, time));
			} else {
				this.$el.html(this.template({
					model: model.toJSON(),
					view: {
						content: viewContent.content || '',
						time: time
					}
				}));
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

		embedContent: function(model, viewContent, async) {
			var type = model.get('type'),
				contentUrl = model.get('contentUrl'),
				postUrl = model.get('postUrl');

			if(type === 'image') {
				viewContent.content = '<a href = "' + postUrl + '" target = "_blank"><img src = "' + contentUrl + '"></a>'
			} else if(type === 'video') {
				if(async === true) {
					$.get(contentUrl, (function(view) {
						return function(data) {
							view.content = data.html;
						}
					}(viewContent)));
				} else {
					$.ajax({
						url: contentUrl, 
						async: false,
						success: function(data) {
							viewContent.content = data.html;
						}
					});
				}
			} else if(type === 'tweet') {
				viewContent.content = '<div class = "tweet">' + this.parseTweet(contentUrl) + '</div>';
			}
		},

		parseTweet: function(rawTweet) {
			var tweet = rawTweet;
			tweet = tweet.replace(/(http|https):\/\/(t\.co)\/(\w*)/g, '<a href = \"' + prefix + '://$2/$3\" target = "blank">' + prefix + '://$2/$3</a>');
			return tweet;
		}
	});

	//	Widget start point
	var postsQueue = new PostsQueue(),
		appView = new WidgetView({collection: postsQueue});

	postsQueue.fetch({
		success: function(el) {
			el.trigger('end_fetch');
		},
		error: function(el, response) {
			$('#MRWidget').html('Sorry, some kind of error has occurred<br>' + response.status + ' ' + response.statusText);
		}
	});
})();