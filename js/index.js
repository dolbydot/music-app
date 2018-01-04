var EventCenter = {
    on(type, handler) {
        $(document).on(type, handler)
    },
    fire(type, data) {
        //trigger()方法触发被选元素的指定事件类型
        $(document).trigger(type, data)
    }
}

var Footer = {
    init() {
        this.$footer = $('footer')
        this.$ul = this.$footer.find('ul')
        this.$box = this.$footer.find('.box')
        this.$leftBtn = this.$footer.find('.icon-left')
        this.$rightBtn = this.$footer.find('.icon-right')
        this.isToEnd = false
        this.isToStart = false
        this.isAnimate = false

        this.bind()
        this.render()
    },
    bind() {
        var _this = this
        this.$rightBtn.on('click', function () {
            if (_this.isAnimate) return
            var itemWidth = _this.$box.find('li').outerWidth(true)//包含内边距外边距及边框
            var rowCount = Math.floor(_this.$box.width() / itemWidth)
            if (!_this.isToEnd) {
                _this.isAnimate = true
                _this.$ul.animate({
                    left: '-=' + rowCount * itemWidth
                }, 400, function () {
                    _this.isAnimate = false
                    _this.isToStart = false
                    if (parseFloat(_this.$box.width()) - parseFloat(_this.$ul.css('left')) >= parseFloat(_this.$ul.css('width'))) {
                        _this.isToEnd = true
                    }
                })
            }
        })

        this.$leftBtn.on('click', function () {
            if (_this.isAnimate) return
            var itemWidth = _this.$box.find('li').outerWidth(true)
            var rowCount = Math.floor(_this.$box.width() / itemWidth)
            if (!_this.isToStart) {
                _this.isAnimate = true
                _this.$ul.animate({
                    left: '+=' + rowCount * itemWidth
                }, 400, function () {
                    _this.isToEnd = false
                    _this.isAnimate = false
                    if (parseFloat(_this.$ul.css('left')) >= 0) {
                        _this.isToStart = true
                    }
                })
            }
        })

        this.$footer.on('click', 'li', function () {
            $(this).addClass('active').siblings().removeClass('active')
            EventCenter.fire('select-albumn', {
                channelId: $(this).attr('data-channel-id'),
                channelName: $(this).attr('data-channel-name')
            })
        })
    },
    render() {
        var _this = this
        $.getJSON('//jirenguapi.applinzi.com/fm/getChannels.php')
            .done(function (ret) {
                // console.log(ret)
                _this.renderFooter(ret.channels)
            }).fail(function () {
                // console.log('error')
            })
    },
    renderFooter(channels) {
        // console.log(channels)
        var html = ''
        channels.unshift({
            channel_id: 0,
            name: '我的最爱',
            cover_small: 'http://cloud.hunger-valley.com/17-10-24/1906806.jpg-small',
            cover_middle: 'http://cloud.hunger-valley.com/17-10-24/1906806.jpg-middle',
            cover_big: 'http://cloud.hunger-valley.com/17-10-24/1906806.jpg-big',
        })
        channels.forEach(function (channel) {
            html += '<li data-channel-id=' + channel.channel_id + ' data-channel-name=' + channel.name + '>'
                + '  <div class="cover" style="background-image:url(' + channel.cover_small + ')"></div>'
                + '  <h3>' + channel.name + '</h3>'
                + '</li>'
        })
        this.$ul.html(html)
        this.setStyle()
    },
    setStyle() {
        var count = this.$footer.find('li').length
        var width = this.$footer.find('li').outerWidth(true)
        this.$ul.css({
            width: count * width + 'px'
        })
    }
}

var Fm = {
    init() {
        this.channelId = 'public_shiguang_80hou'
        this.channelName = 'Dot'
        this.$container = $('#page-music main')
        this.audio = new Audio()
        this.audio.autoplay = true
        this.currentSong = null
        this.clock = null
        this.collections = this.loadFromLocal()
        this.bind()
        this.playInit()
    },
    playInit() {
        //如果标记了‘我的最爱’，在footer的第一个选项显示‘我的最爱’，否则触发loadSong()
        if (this.collections.length > 0) {
            EventCenter.fire('select-albumn', {
                channelId: '0',
                channelName: '我的最爱'
            })
        } else {
            this.loadSong()
        }
    },
    bind() {
        var _this = this
        EventCenter.on('select-albumn', function (e, channel) {
            // console.log('select', channel)
            _this.channelId = channel.channelId
            _this, channelName = channel.channelName
            _this.loadSong()
        })

        this.$container.find('.btn-play').on('click', function () {
            if ($(this).hasClass('icon-pause')) {
                $(this).removeClass('icon-pause').addClass('icon-play')
                _this.audio.pause()
            } else {
                $(this).removeClass('icon-play').addClass('icon-pause')
                _this.audio.play()
            }
        })

        this.$container.find('.btn-next').on('click', function () {
            _this.loadSong()
        })

        this.audio.addEventListener('play', function () {
            clearInterval(_this.clock)
            _this.clock = setInterval(function () {
                _this.updateState()
                _this.setLyric()
            }, 1000)
            // console.log('play')
        })

        this.audio.addEventListener('pause', function () {
            //没找到一曲播放完毕自动播放下一首的api，所以写了以下代码
            if (_this.audio.currentTime === _this.audio.duration) {
                _this.loadSong()
            } else {
                // console.log('pause')
                clearInterval(_this.clock)
            }
        })

        //如果已’喜欢‘,再次点击取消喜欢，样式改变且将该曲目从‘我的喜欢’专辑中移除
        //如果未’喜欢‘,点击图标变红且将该曲目添加到’我的喜欢‘专辑中
        //改变状态后将当前状态缓存下来，除非手动清理不然一直都在
        this.$container.find('.btn-collect').on('click', function () {
            var $btn = $(this)
            if ($btn.hasClass('active')) {
                $btn.removeClass('active')
                delete _this.collections[_this.currentSong.sid]
            } else {
                $(this).addClass('active')
                _this.collections[_this.currentSong.sid] = _this.currentSong
            }
            _this.saveToLocal()
        })
    },
    loadSong() {
        var _this = this
        //如果是’我的最爱‘，则播放我的最爱里的曲目
        if (this.channelId === '0') {
            _this.loadCollection()
        } else {
            $.getJSON('//jirenguapi.applinzi.com/fm/getSong.php', { channel: this.channelId })
                .done(function (ret) {//获取数据成功后播放返回的数据中的第一项，没有返回则不播放
                    _this.play(ret.song[0] || null)
                })
        }
    },
    play(song) {
        // console.log(song)
        this.currentSong = song
        this.audio.src = song.url
        this.$container.find('.btn-play').removeClass('icon-play').addClass('icon-pause')
        this.$container.find('.aside figure').css('background-image', 'url(' + song.picture + ')')
        $('.bg').css('background-image', 'url(' + song.picture + ')')
        this.$container.find('.details h1').text(song.title)
        this.$container.find('.details .author').text(song.artist)
        this.$container.find('.tag').text(this.channelName)

        if (this.collections[song.sid]) {
            this.$container.find('.btn-collect').addClass('active')
        } else {
            this.$container.find('.btn-collect').removeClass('active')
        }

        this.loadLyric(song.sid)
    },
    updateState() {
        this.$container.find('.current-time').text(this.formatTime())
        this.$container.find('.bar-progress').css('width', this.audio.currentTime / this.audio.duration * 100 + '%')

        var _this = this
        $('.bar').on('mousedown', function (e) {
            var barWidth = window.getComputedStyle($('.bar')).width
                .replace(/\.\d+px$/, '')
            var posX = e.clientX//当前点击位置距离浏览器窗口原点的水平距离
            var targetLeft = $('.bar').offsetLeft//$('.bar')原点距离main原点的水平距离
            var outerLeft = _this.$container.getBoundingClientRect().x//main原点距离浏览器窗口原点的水平距离
            var percentage = (posX - targetLeft - outerLeft) / barWidth
            _this.audio.currentTime = _this.audio.duration * percentage
        })
    },
    formatTime() {
        var totalMinutes = Math.floor(this.audio.duration / 60)
        if (totalMinutes < 10) {
            var timeStr = '0' + Math.floor(this.audio.currentTime / 60) + ':'
                + (Math.floor(this.audio.currentTime) % 60 / 100)
                    .toFixed(2).substr(2)//如果有小数，小数四舍五入，只获取整数秒数
        }
        return timeStr
    },
    loadFromLocal() {
        return JSON.parse(localStorage['collections'] || '{}')
    },
    saveToLocal() {
        localStorage['collections'] = JSON.stringify(this.collections)
    },
    loadCollection() {
        var keyArray = Object.keys(this.collections)
        if (keyArray.length === 0) return
        var randomIndex = Math.floor(Math.random() * keyArray.length)
        var randomSid = keyArray[randomIndex]
        this.play(this.collections[randomSid])
    },
    loadLyric(sid) {
        var _this = this
        $.getJSON('//jirenguapi.applinzi.com/fm/getLyric.php', { sid: sid })
            .done(function (ret) {
                // console.log(ret.lyric)
                var lyricObj = {}
                ret.lyric.split('\n').forEach(function (line) {
                    var timeArr = line.match(/\d{2}:\d{2}/g)
                    if (timeArr) {
                        timeArr.forEach(function (time) {
                            lyricObj[time] = line.replace(/\[.+?\]/g, '')
                        })
                    }
                })
                _this.lyricObj = lyricObj
                // console.log(_this.lyricObj)
            })
    },
    setLyric() {
        console.log(this.lyricObj)
        // if (this.lyricObj && this.lyricObj[this.formatTime()]) {
        //     this.$container.find('.lyric p')
        //         .text(this.lyricObj[this.formatTime()])
        //         .boomText()
        // }
        // console.log(this.formatTime())

        var timeStr = '0' + Math.floor(this.audio.currentTime / 60) + ':'
            + (Math.floor(this.audio.currentTime) % 60 / 100).toFixed(2).substr(2)
        if (this.lyricObj && this.lyricObj[timeStr]) {
            this.$container.find('.lyric p').text(this.lyricObj[timeStr])
                .boomText()
        }
        console.log(timeStr)
    },
}

//歌词效果组件
$.fn.boomText = function (type) {
    type = type || 'rollIn'
    console.log(type)
    this.html(function () {
        var arr = $(this).text()
            .split('').map(function (word) {
                return '<span class="boomText">' + word + '</span>'
            })
        return arr.join('')
    })

    var index = 0
    var $boomTexts = $(this).find('span')
    var clock = setInterval(function () {
        $boomTexts.eq(index).addClass('animated' + type)
        index++
        if (index >= $boomTexts.length) {
            clearInterval(clock)
        }
    }, 300)
}

Footer.init()
Fm.init()