const mysql   = require('mysql');

module.exports = {

//datos de conexión en local
/*
    con : mysql.createConnection({
        host: "localhost",
        user:"root",
        password:"",
        database:"api_bamboo"
    })
*/
/*
    con : mysql.createPool({
        host: "localhost",
        user:"root",
        password:"",
        database:"api_bamboo"
    })
*/
//datos de conexión en cloud
    
    con : mysql.createPool({
        host: "127.0.0.1",
        user:"root",
        password:"f8HtENweuGCm",
        database:"api_bamboo"
    })
    
}
