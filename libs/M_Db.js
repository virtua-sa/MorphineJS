"use strict";

var _ = require('lodash');
var async = require('async');

var fs = require('fs') ;
var mysql = require('mysql2') ;
// var Offshore = require('offshore');
// var OffshoreSql = require('offshore-sql');
// var offshore = new Offshore();

class M_TableExec {
    constructor(table) {
        this.table = table ;
        this.def = table.def ;
        this.modelname = this.def.modelname ;
        this.select = [] ;
        this.command = 'SELECT' ;
        this.connection = table.connection ;
        this.primary = 'id' ;
        this.primaryType = 'integer' ;
        this.primaryLength = 11 ;
        this.where = '' ;
        this.whereData = [] ;
        this.onlyOne = false ;
        this.order = '' ;
        this.having = '' ;
        this.groupby = '' ;
        this.tabAlreadyIncluded = [] ;
        this.iscount = false ;
        this.joinModels = [{modelname:this.modelname, fieldJoin:null, modelnameto:null}] ;
        _.each(this.def.attributes, (field, fieldName)=> {
            if (field.primary) {
                this.primary = fieldName ;
                this.primaryType = field.type ;
                this.primaryLength = field.length ;
            }
        }) ;

    }
    select(fields) {
        this.select = fields ;
        return this ;
    }
    find(where, whereData) {
        this.command = 'SELECT' ;
        this.onlyOne = false ;
        this.where = where ;
        if (whereData === undefined) this.whereData = [] ;
        else this.whereData = whereData ;
        return this ;
    }
    count(where, whereData) {
        this.iscount = true ;
        return this.find(where, whereData) ;
    }
    findOne(where, whereData) {
        this.onlyOne = true ;
        this.where = where ;
        if (whereData === undefined) this.whereData = [] ;
        else this.whereData = whereData ;
        return this ;
    }
    create(data) {
        this.onlyOne = false ;
        this.command = 'INSERT' ;
        this.data = data ;
        return this ;
    }
    update(where, whereData, data) {
        if (data === undefined) {
            data = whereData ;
            this.whereData = [] ;
        } else {
            this.whereData = whereData ;
        }
        this.original_where = _.cloneDeep(where) ;
        this.original_whereData = _.cloneDeep(this.whereData) ;

        this.onlyOne = false ;
        this.command = 'UPDATE' ;
        this.where = where ;
        this.data = data ;
        return this ;
    }
    query(query, data) {
        this.command = 'QUERY' ;
        this.whereData = data ;
        this.querySaved = query ;
        return this ;
    }
    // replace(where, whereData, data) {//where, whereData,
    //     console.log("where,whereData,data",where,whereData,data);
    //     if (data === undefined) {
    //         data = whereData ;
    //         this.whereData = [] ;
    //     } else {
    //         this.whereData = whereData ;
    //     }
    //     console.log("data",data);
    //     this.onlyOne = true ;
    //     this.command = 'REPLACE' ;
    //     this.where = where ;
    //     this.data = data ;
    //     return this ;
    // }
    destroy(where, whereData) {
        if (whereData === undefined) {
            this.whereData = [] ;
        } else {
            this.whereData = whereData ;
        }
        this.onlyOne = false ;
        this.command = 'DELETE' ;
        this.where = where ;
        return this ;
    }
    _searchModelNameFromFieldName(fieldJoin, fromModelName) {
        var f = null ;
        // console.log("fromModelName",fromModelName);
        _.each(M_Db.models[fromModelName].def.attributes, (field, fieldName)=> {
            if (fieldName==fieldJoin && field.model) f = field.model ;
        }) ;
        return f ;
    }
    populate(fieldJoin) {
        let tabFieldsJoins = fieldJoin.split('.') ;
        let previousModelName = this.modelname ;
        let tabOrigin = [] ;
        _.each(tabFieldsJoins, (join)=> {
            tabOrigin.push(join) ;
            var modelname = this._searchModelNameFromFieldName(join, previousModelName) ;
            if (modelname && _.indexOf(this.tabAlreadyIncluded, modelname)==-1) {
                this.joinModels.push({modelname:modelname, fieldJoin:join, modelnameto:previousModelName, origin:tabOrigin.join('.')}) ;
                this.tabAlreadyIncluded.push(modelname) ;
            }
            previousModelName = modelname ;
        }) ;
        return this ;
    }
    orderBy(order) {
        this.order = order ;
        return this ;
    }
    groupBy(groupby) {
        this.groupby = groupby ;
        return this ;
    }
    having(having) {
        this.having = having ;
        return this ;
    }
    _createWhere() {
        let where = '' ;
        // let whereData = this.whereData ;
        if (!this.where) {
            where = '1' ;
        } else if (_.isInteger(this.where)) {
            where += this.primary+'=?' ;
            this.whereData.push(this.where) ;
        } else if (_.isObject(this.where)) {
            where += '1' ;
            _.each(this.where, (val,key)=> {
                where += ' && '+key+'=?' ;
                this.whereData.push(val) ;
            }) ;
        } else {
            var isKey = true ;
            if (this.where.indexOf(' ')!==-1) isKey = false ;
            if (this.where.indexOf('>')!==-1) isKey = false ;
            if (this.where.indexOf('<')!==-1) isKey = false ;
            if (this.where.indexOf('=')!==-1) isKey = false ;
            if (isKey) {
                where += this.primary+'=?' ;
                this.whereData.push(this.where) ;
            } else {
                where = this.where ;
            }
        }
        return where ;
    }
    _createSelect() {
        var tabSelect = [] ;
        _.each(this.joinModels, (model, num)=> {
            _.each(M_Db.models[model.modelname].def.attributes, (field, fieldName)=> {
                let as = '' ;
                if (model.modelnameto) as = ' AS '+M_Db.models[model.modelname].def.tableName+'_'+model.fieldJoin+'_'+fieldName ;
                tabSelect.push(M_Db.models[model.modelname].def.tableName+'.'+fieldName+as) ;
            }) ;
        }) ;
        return tabSelect.join(', ') ;
    }
    _createJoin() {
        let tabJoin = [] ;
        _.each(this.joinModels, (model, num)=> {
            if (!model.modelnameto) tabJoin.push(M_Db.models[model.modelname].def.tableName) ;
            else tabJoin.push('LEFT JOIN '+M_Db.models[model.modelname].def.tableName+' ON '+M_Db.models[model.modelname].def.tableName+'.'+M_Db.models[model.modelname].primary+'='+M_Db.models[model.modelnameto].def.tableName+'.'+model.fieldJoin) ;
        }) ;
        return tabJoin.join(' ') ;
    }
    _createOrder() {
        let order = '' ;
        if (this.order) order = ' ORDER BY '+this.order ;
        return order ;
    }
    _createSelectQuery() {

        let query = 'SELECT '+this._createSelect()+' FROM '+this._createJoin()+' WHERE '+this._createWhere()+this._createOrder() ;
        return query ;

    }
    _createInsertQuery() {
        let fields = [],
            vals = [] ;
        _.each(this.data, (val, key)=> {
            if (this.def.attributes[key]) {
                fields.push(key) ;
                vals.push('?') ;
                this.whereData.push(val) ;
            }
        }) ;
        let query = 'INSERT INTO '+this.def.tableName+'('+fields.join(', ')+') VALUES ('+vals.join(', ')+')' ;
        return query ;
    }
    // _createReplaceQuery() {
    //     let fields = [],
    //         vals = [] ;
    //     _.each(this.data, (val, key)=> {
    //         fields.push(key) ;
    //         vals.push('?') ;
    //         this.whereData.push(val) ;
    //     }) ;
    //     let query = 'REPLACE INTO '+this.def.tableName+'('+fields.join(', ')+') VALUES ('+vals.join(', ')+')' ;
    //     return query ;
    // }
    _createUpdateQuery() {
        let vals = [] ;
        _.each(this.data, (val, key)=> {
            if (this.def.attributes[key]) {
                vals.push(key+'=?') ;
                this.whereData.push(val) ;
            }
        }) ;
        let query = 'UPDATE '+this.def.tableName+' SET '+vals.join(', ')+' WHERE '+this._createWhere() ;
        return query ;
    }
    _createDestroyQuery() {
        let query = 'DELETE FROM '+this.def.tableName+' WHERE '+this._createWhere() ;
        return query ;
    }
    _preTreatment() {
        // console.log("this.data",this.data);
        _.each(this.def.attributes, (field, fieldName)=> {
            // console.log("fieldName,field.type",fieldName,field.type);
            if (this.data[fieldName]===undefined) return ;
            let key = fieldName ;
            let val = this.data[key] ;
            if (field.type=='json' && _.isObject(val)) {
                try {
                    this.data[key] = JSON.stringify(this.data[key]) ;
                } catch(e) {
                    console.log("json stringify error",e);
                    this.data[key] = '' ;
                }
            }
            if (field.type=='json' && !_.isObject(val)) {
                try {
                    this.data[key] = JSON.parse(this.data[key]) ;
                    this.data[key] = JSON.stringify(this.data[key]) ;
                    // console.log("this.data[key]",this.data[key]);
                } catch(e) {
                    console.log("json stringify error",e);
                    this.data[key] = '' ;
                }
            }
            if (field.type=='boolean') {
                // console.log("isboolean1",this.data[fieldName]);
                if (this.data[fieldName]===false) this.data[fieldName] = 0 ;
                if (this.data[fieldName]===true) this.data[fieldName] = 1 ;
                // console.log("isboolean2",this.data[fieldName]);
            }
        }) ;
    }
    _postTreatment(rows) {
        _.each(rows, (row)=> {
            _.each(this.def.attributes, (field, fieldName)=> {
                if (field.type=='json') {
                    try {
                        if (row[fieldName]) row[fieldName] = JSON.parse(row[fieldName]) ;
                        else row[fieldName] = null ;
                    } catch(e) {
                        console.log("json parse error",e,fieldName, row[fieldName]);
                        row[fieldName] = null ;
                    }
                }
            }) ;
            let alreadyOrigins = [] ;
            _.each(this.joinModels, (model, num)=> {
                if (model.modelnameto) {
                    // this._setObjectToRow(row, row, model.modelname, model.modelnameto, model.fieldJoin) ;
                    let obj = {} ;
                    _.each(M_Db.models[model.modelname].def.attributes, (field, fieldName)=> {
                        let f = M_Db.models[model.modelname].def.tableName+'_'+model.fieldJoin+'_'+fieldName ;
                        if (row.hasOwnProperty(f)) {
                            obj[fieldName] = row[f] ;
                            delete row[f] ;
                        }
                    }) ;
                    if (!obj[M_Db.models[model.modelname].primary]) {
                        // console.log("M_Db.models[model.modelname].primary",M_Db.models[model.modelname].primary, obj);
                        obj = null ;
                    }
                    let tabFieldsJoins = model.origin.split('.') ;
                    let previousObj = row ;
                    let lastO = null ;
                    _.each(tabFieldsJoins, (o, index)=> {
                        lastO = o ;
                        if (index>=tabFieldsJoins.length-1) return ;
                        previousObj = previousObj[o] ;
                    }) ;
                    if (previousObj) previousObj[lastO] = obj ;
                }
            }) ;
        }) ;
    }
    _beforeQuery(cb) {
        let fn = null, fn2 = null ;
        switch (this.command) {
            case 'UPDATE':
            if (this.def.useUpdatedAt) this.data.updatedAt = new Date() ;
            if (this.def.beforeUpdate) fn = this.def.beforeUpdate ;
            break;
            case 'DELETE':
            if (this.def.beforeDestroy) fn2 = this.def.beforeDestroy ;
            break;
            case 'INSERT':
            if (this.def.useCreatedAt) this.data.createdAt = new Date() ;
            if (this.def.useUpdatedAt) this.data.updatedAt = new Date() ;
            if (this.def.beforeCreate) fn = this.def.beforeCreate ;
            break;
            // case 'REPLACE':
            // if (this.def.beforeCreate) fn = this.def.beforeCreate ;
            // break;
            default:
            if (this.def.beforeSelect) fn = this.def.beforeSelect ;
        }
        if (fn) fn(this.data, cb) ;
        else if (fn2) fn(cb) ;
        else cb() ;
    }
    exec(cb, returnCompleteRow) {
        // console.log("this.command,this.data",this.command,this.data);
        let thenUpdateOrCreate = false ;
        this._beforeQuery(() => {
            let query ;
            switch (this.command) {
                case 'QUERY':
                query = this.querySaved ;
                break;
                case 'INSERT':
                this._preTreatment() ;
                query = this._createInsertQuery() ;
                break;
                case 'UPDATE':
                this._preTreatment() ;
                query = this._createUpdateQuery() ;
                break;
                case 'DELETE':
                query = this._createDestroyQuery() ;
                break;
                // case 'REPLACE':
                // query = this._createSelectQuery() ;
                // thenUpdateOrCreate = true ;
                // break;
                default:
                query = this._createSelectQuery() ;
            }

            // console.log("query",query, this.whereData);
            if (this.def.debug) console.log("query",query, this.whereData);
            this.connection.query({
                sql: query,
                values: this.whereData,
                nestTables: false
            }, (err, rows, fields)=> {
                let res ;
                // if (err) throw err;
                switch (this.command) {
                    case 'QUERY':
                    res = rows ;
                    break;
                    case 'UPDATE':
                    res = rows.affectedRows ;
                    // console.log("rows",rows);
                    break;
                    case 'DELETE':
                    res = rows.affectedRows ;
                    break;
                    case 'INSERT':
                    this.data[this.primary] = rows.insertId ;
                    // res = this.data ;
                    res = rows.insertId ;
                    break;
                    // case 'REPLACE':
                    // if (rows.length) res = rows[0] ;
                    // else res = null ;
                    // // res = rows.insertId ;
                    // break;
                    default:
                    this._postTreatment(rows) ;
                    if (this.onlyOne) {
                        if (rows.length) res = rows[0] ;
                        else res = null ;
                    } else res = rows ;
                }
                if (this.def.debug) console.log("res",res);
                // console.log('The solution is: ', rows);
                if (err) return cb(err, res) ;
                if (returnCompleteRow && (this.command=='UPDATE' || this.command=='INSERT')) {
                    // console.log("this.command",this.command);
                    if (this.command=='UPDATE') {
                        this.table.find(this.original_where, this.original_whereData).exec((errsql, rows2)=> {
                            if (errsql) console.log("errsql",errsql);
                            cb(errsql, rows2) ;
                        }) ;
                    } else {
                        this.table.findOne(res).exec((errsql, rows2)=> {
                            if (errsql) console.log("errsql",errsql);
                            cb(errsql, rows2) ;
                        }) ;

                    }
                } else return cb(err, res) ;
            });
        }) ;

    }
}
class M_Table {
    constructor(def, connection) {
        // console.log(def);
        this.def = def ;
        this.connection = connection ;
        this.modelname = this.def.modelname ;
        this.primary = '' ;
        this.primaryType = 'integer' ;
        this.primaryLength = 11 ;
        _.each(this.def.attributes, (field, fieldName)=> {
            if (field.primary) {
                this.primary = fieldName ;
                this.primaryType = field.type ;
                if (field.length) this.primaryLength = field.length ;
            }
        }) ;
    }
    use(connectionId) {
        var exec = new M_TableExec(this) ;
        return exec ;
    }
    select(fields) {
        var exec = new M_TableExec(this) ;
        return exec.select(fields) ;
    }
    find(where, whereData) {
        var exec = new M_TableExec(this) ;
        return exec.find(where, whereData) ;
    }
    findOne(where, whereData) {
        var exec = new M_TableExec(this) ;
        return exec.findOne(where, whereData) ;
    }
    create(data) {
        var exec = new M_TableExec(this) ;
        return exec.create(data) ;
    }
    update(where, whereData, data) {
        var exec = new M_TableExec(this) ;
        return exec.update(where, whereData, data) ;
    }
    replace(where, whereData, data, cb) {//where, whereData,
        // var exec = new M_TableExec(this.def, this.connection) ;
        // return exec.replace(data) ;//where, whereData,
        // let whereData2 = [] ;
        // if (data === undefined) {
        //     data = whereData ;
        // } else {
        //     whereData2 = whereData ;
        // }
        let where2 = _.cloneDeep(where) ;
        let whereData2 = _.cloneDeep(whereData) ;
        // let data2 = _.cloneDeep(data) ;
        this.findOne(where, whereData).exec((errsql, _row)=> {
            if (errsql) console.log("errsql",errsql);
            if (!_row) this.create(data).exec(cb) ;
            else this.update(where2, whereData2, data).exec(cb) ;
        }) ;
    }
    destroy(where, whereData) {
        var exec = new M_TableExec(this) ;
        return exec.destroy(where, whereData) ;
    }
    query(query, data) {
        var exec = new M_TableExec(this) ;
        return exec.query(query, data) ;
    }
}

var M_Db = new (class {
    init(config, cb) {
        this.config = config.models ;
        // console.log("this.config",this.config);
        // this.config.mysql.connection.debug = true ;
        this.connection = mysql.createConnection(this.config.mysql.connection);
        this.connection.connect();

        let files = fs.readdirSync(process.cwd()+'/models') ;
        this.models = {} ;
        _.each(files, (file)=> {
            file = file.substring(0,file.length-3) ;
            var def = require(process.cwd()+'/models/'+file) ;
            if (def.useUpdatedAt===undefined) def.useUpdatedAt = true ;
            if (def.useCreatedAt===undefined) def.useCreatedAt = true ;
            if (def.useCreatedAt) def.attributes['createdAt'] = {type:'datetime',index:true} ;
            if (def.useUpdatedAt) def.attributes['updatedAt'] = {type:'datetime',index:true} ;
            if (!def.tableName) def.tableName = file.toLowerCase() ;
            def.modelname = file ;
            def.debug = this.config.debug ;
            GLOBAL[file] = this.models[file] = new M_Table(def, this.connection) ;
        }) ;
        cb() ;
    }
    _ormTypeToDatabaseType(ormtype, length, info) {
        if (!info) info = 'type' ;
        let typeJS = '' ;
        ormtype = ormtype.toLowerCase() ;
        let res = '' ;
        if (ormtype=='int' || ormtype=='integer') {
            if (!length) length = 11 ;
            res = 'INT('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='tinyint') {
            if (!length) length = 4 ;
            res = 'TINYINT('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='smallint') {
            if (!length) length = 6 ;
            res = 'SMALLINT('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='mediumint') {
            if (!length) length = 9 ;
            res = 'MEDIUMINT('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='year') {
            if (!length) length = 4 ;
            res = 'YEAR('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='float') {
            res = 'FLOAT' ;
            if (length) res+='('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='double') {
            res = 'DOUBLE' ;
            typeJS = 'number' ;


        // } else if (ormtype=='timestamp') {
        //     res = 'TIMESTAMP' ;
        } else if (ormtype=='date') {
            res = 'DATE' ;
            typeJS = 'date' ;
        } else if (ormtype=='datetime') {
            res = 'DATETIME' ;
            typeJS = 'date' ;


        } else if (ormtype=='char') {
            if (!length) length = 1 ;
            res = 'CHAR('+length+')' ;
            typeJS = 'string' ;
        } else if (ormtype=='varchar' || ormtype=='string') {
            if (!length) length = 255 ;
            res = 'VARCHAR('+length+')' ;
            typeJS = 'string' ;
        } else if (ormtype=='tinytext') {
            res = 'TINYTEXT' ;
            typeJS = 'string' ;
        } else if (ormtype=='mediumtext') {
            res = 'MEDIUMTEXT' ;
            typeJS = 'string' ;
        } else if (ormtype=='longtext') {
            res = 'LONGTEXT' ;
            typeJS = 'string' ;
        } else if (ormtype=='text' || ormtype=='json') {
            res = 'TEXT' ;
            typeJS = 'string' ;
        } else if (ormtype=='enum') {
            res = 'ENUM' ;
            typeJS = 'string' ;
        } else if (ormtype=='set') {
            res = 'SET' ;
            typeJS = 'string' ;
        } else if (ormtype=='decimal' || ormtype=='price') {
            if (!length) length = '10,2' ;
            res = 'DECIMAL('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='bigint') {
            if (!length) length = 20 ;
            res = 'BIGINT('+length+')' ;
            typeJS = 'number' ;
        } else if (ormtype=='time') {
            res = 'TIME' ;
            typeJS = 'number' ;


        } else if (ormtype=='tinyblob') {
            res = 'TINYBLOB' ;
            typeJS = 'string' ;
        } else if (ormtype=='mediumblob') {
            res = 'MEDIUMBLOB' ;
            typeJS = 'string' ;
        } else if (ormtype=='longblob') {
            res = 'LONGBLOB' ;
            typeJS = 'string' ;
        } else if (ormtype=='blob') {
            res = 'BLOB' ;
            typeJS = 'string' ;
        } else if (ormtype=='binary') {
            res = 'BINARY' ;
            typeJS = 'binary' ;
        } else if (ormtype=='varbinary') {
            res = 'VARBINARY' ;
            typeJS = 'binary' ;
        } else if (ormtype=='bit') {
            res = 'BIT' ;
            typeJS = 'boolean' ;
        } else if (ormtype=='boolean') {
            res = 'TINYINT(4)' ;
            typeJS = 'boolean' ;
        }



        if (info=='typejs') return typeJS ;
        else return res ;
    }

    createTable(model, cb) {
        var def = model.def ;

        var exists = false ;
        var currentDef ;
        async.series([
            (next)=> {
                // this.knex.schema.hasTable(def.name).then((_exists)=> {
                //     exists = _exists ;
                //     next();
                // }).catch(console.log) ;
                // console.log("def.tableName",def.tableName);
                this.connection.query("SELECT * FROM "+def.tableName+" LIMIT 0,1", (errsql, rows)=> {
                    // console.log("errsql,rows",errsql,rows);
                    if (!errsql) exists = true ;
                    next() ;
                }) ;
            },
            (next)=> {
                if (this.config.migrate=='recreate') {
                    exists = false ;
                    this.connection.query("DROP TABLE IF EXISTS "+def.tableName+"", (errsql, rows)=> {
                        if(errsql) console.log("errsql2",errsql);
                        next() ;
                    }) ;
                } else next() ;
            },
            (next)=> {
                if (exists && this.config.migrate=='alter') {
                    this.connection.query("DESCRIBE "+def.tableName+"", (err, rows, fields)=> {
                        // console.log("rows,fields",def.tableName,rows);
                        async.eachOfSeries(def.attributes, (field, fieldName, nextField)=> {
                            let type1 = null ;
                            if (field.model) {
                                let f = this._getJoinedModel(field) ;
                                // console.log("f",f);
                                if (f) type1 = this._ormTypeToDatabaseType(f[0], f[1]) ;
                            } else {
                                // console.log("field.type",field.type);
                                type1 = this._ormTypeToDatabaseType(field.type, field.length) ;
                            }
                            let type2 = null ;
                            _.each(rows, (row)=> {
                                if (row.Field==fieldName) type2 = row.Type ;
                            }) ;

                            if (type2 === null) {
                                // console.log("field2",field,fieldName);
                                if (field.model) {
                                    var f = this._getJoinedModel(field) ;
                                    field.type = f[0] ;
                                    field.length = f[1] ;
                                }
                                let q = "ALTER TABLE "+def.tableName+" ADD "+fieldName+" "+this._ormTypeToDatabaseType(field.type, field.length)+this._getNotnull(field)+this._getIndex(field)+this._getDefault(field) ;
                                console.log("q",q);
                                this.connection.query(q, (errsql, rows)=> {
                                    if(errsql) console.log("errsql",errsql);
                                    nextField() ;
                                }) ;
                            } else if (type1 && type2 && type1.toLowerCase()!=type2.toLowerCase()) {
                                // console.log("field3",field);
                                let q = "ALTER TABLE "+def.tableName+" CHANGE "+fieldName+" "+fieldName+" "+this._ormTypeToDatabaseType(field.type, field.length)+this._getNotnull(field)+this._getDefault(field) ;
                                console.log("q",q);
                                this.connection.query(q, (errsql, rows)=> {
                                    if(errsql) console.log("errsql",errsql);
                                    nextField() ;
                                }) ;

                            } else nextField() ;
                        }) ;
                        next() ;
                    }) ;

                } else next() ;
            },
            (next)=> {
                if (!exists) {
                    let what = [] ;
                    _.each(def.attributes, (field, fieldName)=> {
                        if (field.model) {
                            var f = this._getJoinedModel(field) ;
                            if (f) what.push(fieldName+' '+this._ormTypeToDatabaseType(f[0], f[1])) ;
                        } else {
                            what.push(fieldName+' '+this._ormTypeToDatabaseType(field.type, field.length)+this._getNotnull(field)+this._getIndex(field)+this._getDefault(field)) ;
                        }
                    }) ;
                    let q = "CREATE TABLE "+def.tableName+" ("+what.join(', ')+")" ;
                    console.log("q",q);
                    this.connection.query(q, (errsql, rows)=> {
                        if(errsql) console.log("errsql",errsql);
                        next() ;
                    }) ;

                } else next() ;
            },
            (next)=> {
                if (this.config.migrate=='alter') {
                    let q = "SHOW INDEX FROM "+def.tableName+"" ;
                    this.connection.query(q, (errsql, rows)=> {
                        // console.log("rows",rows);
                        async.eachOfSeries(def.attributes, (field, fieldName, nextField)=> {
                            let createIndex = false ;
                            if (field.model || field.index) {
                                createIndex = true ;
                                _.each(rows, (row)=> {
                                    if (row.Column_name==fieldName) createIndex = false ;
                                }) ;
                            }
                            if (createIndex) {
                                let q = "ALTER TABLE "+def.tableName+" ADD INDEX ("+fieldName+")" ;
                                console.log("q",q);
                                this.connection.query(q, (errsql, rows)=> {
                                    if(errsql) console.log("errsql",errsql);
                                    nextField() ;
                                }) ;
                            } else nextField() ;
                        }, ()=> {
                            next() ;
                        }) ;
                    }) ;
                }
            }

        ], function() {
            cb() ;
        }) ;

    }
    _getIndex(field) {
        let res = '' ;
        if (field.primary) res += ' PRIMARY KEY' ;
        if (field.autoincrement) res += ' AUTO_INCREMENT' ;
        return res ;
    }
    _getNotnull(field) {
        let res = '' ;
        if (field.notnull || typeof field.notnull == 'undefined') res = ' NOT NULL' ;
        else res = ' NULL' ;
        return res ;
    }
    _getDefault(field) {
        let defaultsTo = '' ;
        if (typeof field.defaultsTo !== 'undefined') defaultsTo = ' DEFAULT "'+field.defaultsTo+'"' ;
        return defaultsTo ;
    }
    _getJoinedModel(field) {
        // console.log("field",field);
        if (this.models[field.model]) {
            return [this.models[field.model].primaryType, this.models[field.model].primaryLength] ;
        } else console.log("Model "+field.model+" not found") ;
        return null ;
    }
})() ;

module.exports = M_Db ;


