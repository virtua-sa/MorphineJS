"use strict";

var express = require('express');
var expressLayouts = require('express-ejs-layouts');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var compression = require('compression');
var session = require('express-session');
var RedisStore = require('connect-redis')(session);
// var favicon = require('serve-favicon');
// var multer  = require('multer');
// var upload = multer({ dest: 'uploads/' });


var app = express();
var M_Db = require('./M_Db');
var fs = require('fs') ;
var _ = require('lodash') ;
var async = require('async') ;
var moment = require('moment') ;

var http = require('http').Server(app);
var io = require('socket.io')(http);
var colors = require('colors');
var skipper  = require('skipper');



module.exports = class MorphineServer {

    initConfig() {
        let config = {} ;
        let files = fs.readdirSync(process.cwd()+'/config') ;
        _.each(files, (file)=> {
            file = file.substring(0,file.length-3) ;
            if (file=='local') return ;
            config[file] = require(process.cwd()+'/config/'+file);
        }) ;
        // config.packages = require(process.cwd()+'/assets/packages.js');
        try {
            var ok = fs.accessSync(process.cwd()+'/config/local.js', fs.R_OK) ;
            Object.assign(config, require(process.cwd()+'/config/local')) ;
        } catch (err) {
            // console.log("err",err);
        }
        // console.log("config",config);
        this.config = config ;
    }

    isMultipart(req) {
        if (req.headers && req.headers['content-type'] &&
            req.headers['content-type'].substr(0,9).toLowerCase()=='multipart')
            return true ;
        return false ;
    }

    initGlobals() {
        GLOBAL.morphineserver = this ;
        morphineserver.express = express ;
        morphineserver.app = app ;

        _.each(this.config.globals, (glob, globkey)=> {
            if (glob=='lodash') GLOBAL[globkey] = _ ;
            else if (glob=='async') GLOBAL[globkey] = async ;
            else if (glob=='moment') GLOBAL[globkey] = moment ;
            else GLOBAL[globkey] = require(glob) ;
        }) ;

        GLOBAL.async = async ;

        morphineserver.rootDir = process.cwd() ;
        // console.log("morphineserver.rootDir",morphineserver.rootDir);
    }



    initServices() {
        let services = {} ;
        let files = fs.readdirSync(process.cwd()+'/services') ;
        _.each(files, (file)=> {
            file = file.substring(0,file.length-3) ;
            var c = require(process.cwd()+'/services/'+file);
            GLOBAL[file] = c ;
        }) ;
    }


    initRoutes() {
        var controllers = {} ;

        // app.all('*', function(req, res, next) {
        //     next() ;
        // });


        _.each(this.config.router.routes, (route, url)=> {
            if (!controllers[route.controller]) {
                // console.log("route.controller",route.controller);
                try {
                    let c = require(process.cwd()+'/controllers/'+route.controller) ;
                    controllers[route.controller] = new c() ;
                } catch (e) {
                    console.log("Controller file "+route.controller+" doesn't exists");
                    return ;
                }
            }
            if (!controllers[route.controller][route.action]) {
                console.log("Action "+route.action+" in "+route.controller+" doesn't exists");
                return ;
            }
            // console.log("controllers",controllers[route.controller]);
            // console.log("url",url);
            // var r = morphineserver.app.route(url) ;


            var tabMethodUrl = url.split(' ') ;
            // console.log("method",tabMethodUrl);
            var f = (req, res)=> {
                req.controller = route.controller ;
                req.action = route.action ;
                if (!route.policies) route.policies = [] ;
                req.policies = route.policies ;
                // console.log("req.policies",req.policies);
                if (!res.locals) res.locals = {} ;
                Object.assign(res.locals, {
                    req: req,
                }) ;
                controllers[route.controller].before(req, res, ()=> {
                    let ok = true ;
                    async.eachSeries(route.policies, (policy, nextPolicy)=> {
                        if (!Policies[policy]) {
                            console.log("Policy "+policy+" not found");
                            ok = false ;
                            return nextPolicy() ;
                        }
                        Policies[policy](req, res, (_ok)=> {
                            // console.log("ok2",_ok);
                            if (!_ok) ok = false ;
                            nextPolicy() ;
                        }) ;
                    }, ()=> {
                        if (ok) controllers[route.controller][route.action](req, res) ;
                    }) ;

                    // controllers[route.controller].policies(req, res, (ok)=> {
                    //     console.log("ok",ok);
                    //     if (ok) controllers[route.controller][route.action](req, res) ;
                    //     // else {}
                    // }) ;
                }) ;
            } ;
            if (tabMethodUrl[0]=='GET') morphineserver.app.get(tabMethodUrl[1], f) ;
            else if (tabMethodUrl[0]=='PUT') morphineserver.app.put(tabMethodUrl[1], f) ;
            else if (tabMethodUrl[0]=='POST') morphineserver.app.post(tabMethodUrl[1], f) ;
            else if (tabMethodUrl[0]=='DELETE') morphineserver.app.delete(tabMethodUrl[1], f) ;
            else morphineserver.app.all(url, f) ;
        }) ;

    }

    initIoSocket() {
        io.on('connection', function(socket){
            Sockets.onConnection(socket) ;
        });
    }


    initTasks(nextinit) {
        var ok ;

        try {
            ok = fs.accessSync(process.cwd()+'/.tmp', fs.R_OK) ;
        } catch(err) {
            fs.mkdirSync(process.cwd()+'/.tmp') ;
        }
        try {
            ok = fs.accessSync(process.cwd()+'/assets/compiled', fs.R_OK) ;
        } catch(err) {
            fs.mkdirSync(process.cwd()+'/assets/compiled') ;
        }

        var livereload = require('livereload');
        this.livereloadServer = livereload.createServer({
            port: morphineserver.config.tasks.livereloadPort,
            exts: morphineserver.config.tasks.livereloadExtensions,
            // debug: true
        });


        require(process.cwd()+'/tasks/on-start')(()=> {
            nextinit() ;
        }) ;

    }

    initMiddleware(nextinit) {



        // app.use('/assets', express.static('assets')) ;
        // app.use('/bower_components', express.static('public'));
        app.use(express.static('assets')) ;

        app.set('view engine', 'ejs') ;
        app.use(expressLayouts) ;

        // 'startRequestTimer',
        // 'cookieParser',
        // 'session',
        //
        // 'passportInit',
        // 'passportSession',
        //
        // 'myRequestLogger',
        // 'bodyParser',
        // 'handleBodyParserError',
        // 'compress',
        // 'methodOverride',
        // 'poweredBy',
        // '$custom',
        // 'router',
        // 'www',
        // 'favicon',
        // '404',
        // '500'

        app.use(cookieParser()) ;

        var sess = {
            secret: 'a4f8b71f-c873-4447-8ee2',
            cookie: {},
            saveUninitialized: true,
            resave: true
        } ;
        // if (this.config.environment=='production') {
        //     app.set('trust proxy', 1) ; // trust first proxy
        //     sess.cookie.secure = true ; // serve secure cookies
        // }
        sess.store = new RedisStore(morphineserver.config.models.redis) ;
        app.use(session(sess)) ;



        app.use(bodyParser.urlencoded({ extended: false })) ;
        app.use(bodyParser.json()) ;
        app.use(skipper()) ;


        app.use(Passport.initialize());
        app.use(Passport.session());

        app.use(compression()) ;

        if (this.config.sockets.config.useSockets) {
            app.use((req, res, next)=> {
                req.io = io ;
                next() ;
            }) ;

        }

        // app.use(favicon(process.cwd() + '/assets/favicon.ico'));


        nextinit() ;

    }

    start() {
        // console.log("config",config);


        async.series([
            (nextinit) => {
                this.initConfig() ;
                nextinit() ;
            },
            (nextinit) => {
                this.initGlobals() ;
                nextinit() ;
            },
            (nextinit) => {
                this.initServices() ;
                nextinit() ;
            },
            (nextinit) => {
                this.initMiddleware(() => {
                    nextinit() ;
                }) ;
            },
            (nextinit) => {
                if (this.config.sockets.config.useSockets) this.initIoSocket() ;
                nextinit() ;
            },


            (nextinit) => {

                this.initRoutes() ;

                // var requestContext = {
                //   transport: 'socket.io', // TODO: consider if this is really helpful or just a waste of LoC
                //   protocol: 'ws', // TODO: consider if this is really helpful or just a waste of LoC
                //   isSocket: true,
                //   ip      : '192.168.0.1',
                //   port    : 3000,
                //   url     : '/',
                //   method  : 'GET',
                //   body    : {},
                //   headers: _.defaults({
                //     host: 'localhost',
                //     cookie: (function (){
                //       var _cookie;
                //     //   try {
                //     //     _cookie = options.socket.handshake.headers.cookie;
                //     //   }
                //     //   catch (e) {}
                //       // console.log('REQUEST to "%s %s" IS USING COOKIE:', options.eventName, options.incomingSailsIOMsg.url, _cookie);
                //       return _cookie;
                //     })(),
                //     nosession: true,
                //   }, {})
                // };
                //
                // this.app.route(requestContext, {toto:"titi"}) ;


                nextinit() ;


            },
            (nextinit) => {
                M_Db.init(this.config, ()=> {
                    async.eachOfSeries(M_Db.models, (model, modelname, next)=> {
                        M_Db.createTable(model, next) ;
                    }, ()=> {
                        nextinit() ;
                    }) ;


                }) ;
            },
            (nextinit) => {
                this.config.bootstrap(() => {
                    nextinit() ;
                }) ;
            },


            (nextinit) => {
                this.initTasks(() => {
                    nextinit() ;
                }) ;
            },


        ], () => {


            http.listen(this.config.port,  ()=> {
                console.log(('Listen on port '+(this.config.port+'').bold+' in '+this.config.environment.bold+' environment').bgGreen);
                console.log(('Date : '+moment().format('DD MMMM YYYY HH:mm:ss').green));
                console.log(
`
         _.._..,_,_
        (          )
         ]~,"-.-~~[
       .=])' (;  ([
       | ]:: '    [
       '=]): .)  ([
         |:: '    |
          ~~----~~
`
                );

                if (this.livereloadServer) {
                    setTimeout(()=> {
                        this.livereloadServer.refresh('') ;
                    }, 1000) ;
                }
            });
        }) ;


    }


    launchTasks(tasks, cb) {
        if (!_.isArray(tasks)) tasks = [tasks] ;
        async.eachSeries(tasks, (task, nextTask)=> {
            require(process.cwd()+'/tasks/'+task)(()=> {
                nextTask() ;
            }) ;
        }, ()=> {
            if (cb) cb() ;
        }) ;
    }


} ;

