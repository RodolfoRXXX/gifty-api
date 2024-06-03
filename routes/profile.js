const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const app     = express();
const keys    = require('../settings/keys');
const path = require('path');
const cors = require('cors');
const fs = require("fs");
const Jimp = require("jimp");
const connection = require('../settings/connection');

const md5     = require('md5');
const jwt     = require('jsonwebtoken');
const save_image = require('../functions/saveImage');


/* ----------------------- POST --------------------------*/

// Desbloquea la cuenta del usuario cundo se ingresa el código de activación asignado a dicha cuenta
router.post('/verificate-user', auth.verifyToken, async function(req, res, next){
    try{
        let {email, activation_code} = req.body;

        const checkCode = `SELECT * FROM users WHERE email = ? AND activation_code = ?`;
        connection.con.query(checkCode, [email, activation_code], (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    const activate = `UPDATE users SET state = 1 WHERE id = ?`;
                    connection.con.query(activate, result[0].id, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else{
                            res.send({status: 1, data: result});
                        }
                    });
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Verifica la contraseña del usuario
router.post('/verificate-password', auth.verifyToken, async function(req, res, next){
    try{
        let {id, password} = req.body;

        const hashed_password = md5(password.toString())
        const checkPassword = `SELECT * FROM users WHERE id = ? AND password = ?`;
        connection.con.query(checkPassword, [id, hashed_password], (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza el nombre de usuario
router.post('/update-username', auth.verifyToken, async function(req, res, next){
    try {
        let {id, name} = req.body;

        let changedRows;
        const sql = `UPDATE users SET name = ? WHERE id = ?`;
        connection.con.query(sql, [name, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                changedRows = result.changedRows
                const sql_data = `SELECT u.id, u.name, u.email, u.password, u.thumbnail, e.name AS enterprise, u.activation_code, u.state FROM users AS u INNER JOIN enterprise AS e ON u.id_enterprise = e.id WHERE u.id = ?`;
                connection.con.query(sql_data, id, (err, result, field) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, thumbnail: result[0].thumbnail, enterprise: result[0].enterprise, activation_code: result[0].activation_code, state: result[0].state}]
                            //éxito al modificar usuario
                            let token = jwt.sign({data: user}, keys.key);
                            res.send({status: 1, data: user, token: token, changedRows: changedRows});
                    }
                })
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza la contraseña del usuario
router.post('/update-password', auth.verifyToken, async function(req, res, next){
    try {
        let {id, password} = req.body;

        const hashed_password = md5(password.toString())
        const sql = `UPDATE users SET password = ? WHERE id = ?`;
        connection.con.query(sql, [hashed_password, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                res.send({status: 1, data: result});
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza el correo electrónico del usuario
router.post('/update-email', auth.verifyToken, async function(req, res, next){
    try {
        let {id, email, activation_code, state} = req.body;

        const sql = `UPDATE users SET email = ?, activation_code = ?, state = ? WHERE id = ?`;
        connection.con.query(sql, [email, activation_code, state, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                res.send({status: 1, data: result})
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Carga una nueva imagen de usuario
router.post('/load-user-image', auth.verifyToken, async (req, res, next) => {
    try {
        let {id, thumbnail, blanck} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id, 'user', thumbnail, blanck)
            .then( value => {
                if(value == 'error') throw 'error';
                else {
                    thumbnail = value;
                }
            } )
            .catch( error => {
                throw error;
            } )
        }
        const sql_data = `SELECT u.id, u.name, u.email, u.password, u.thumbnail, e.name AS enterprise, u.activation_code, u.state FROM users AS u INNER JOIN enterprise AS e ON u.id_enterprise = e.id WHERE u.id = ?`;
        connection.con.query(sql_data, id, (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, thumbnail: thumbnail, enterprise: result[0].enterprise, activation_code: result[0].activation_code, state: result[0].state}]
                let token = jwt.sign({data: user}, keys.key);
                if(blanck) {
                    const sql = `UPDATE users SET thumbnail = ? WHERE id = ?`;
                    connection.con.query(sql, [thumbnail, id], (err, result, field) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            changedRows = result.changedRows
                            res.send({status: 1, data: user, token: token, changedRows: changedRows});
                        }
                    })
                } else {
                    changedRows = 1
                    res.send({status: 1, data: user, token: token, changedRows: changedRows});
                }
            }
        })
    } catch (error) {
        res.send({status: 0, data: error});
    }
    connection.con.end;
});

// Carga un nuevo logo para la empresa
router.post('/load-logo-image', auth.verifyToken, async (req, res, next) => {
    try {
        let {id, thumbnail, blanck} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id, 'enterprise', thumbnail, blanck)
            .then( value => {
                if(value == 'error') throw 'error';
                else {
                    thumbnail = value;
                }
            } )
            .catch( error => {
                throw error;
            } )
        }

        if(blanck) {
            const sql = `UPDATE enterprise SET thumbnail = ? WHERE id = ?`;
            connection.con.query(sql, [thumbnail, id], (err, result, field) => {
                if (err) {
                    res.send({status: 0, data: err});
                } else {
                    changedRows = result.changedRows
                    res.send({status: 1, changedRows: changedRows});
                }
            })
        } else {
            changedRows = 1
            res.send({status: 1, changedRows: changedRows});
        }
    } catch (error) {
        res.send({status: 0, data: error});
    }
    connection.con.end;
});

// Actualiza los valores de la empresa
router.post('/update-enterprise', auth.verifyToken, async function(req, res, next){
    try {
        let {id, name, cuit, address, cp, phone_1, phone_2, city, state, country } = req.body;

        const sql = `UPDATE enterprise SET name = ?, address= ?, phone_1 = ?, phone_2 = ?, cp = ?, country = ?, state = ?, city = ?, cuit = ? WHERE id = ?`;
        connection.con.query(sql, [name, address, phone_1, phone_2, cp, country, state, city, cuit, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                res.send({status: 1, data: result})
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza los valores de un empleado (personal)
router.post('/update-employee-personal', auth.verifyToken, async function(req, res, next){
    try {
        let {id_user, name, email, address, date, phone, mobile } = req.body;
        const _sql = `UPDATE employee SET name = ?, email = ?, address= ?, date = ?, phone = ?, mobile = ? WHERE id_user = ?`;
        const _arr = [name, email, address, date, phone, mobile, id_user];
        let changedRows;

            connection.con.query(_sql, _arr, (err, result, field) => {
                if (err) {
                    res.send({status: 0, data: err});
                } else {
                    changedRows = result.changedRows
                    const sql_data = `SELECT * FROM employee WHERE id_user = ?`;
                        connection.con.query(sql_data, id_user, (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                    //éxito al modificar y recargar datos empleado
                                    res.send({status: 1, data: result, changedRows: changedRows});
                            }
                        })
                }
            })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza los valores de un empleado (laboral)
router.post('/update-employee-work', auth.verifyToken, async function(req, res, next){
    try {
        let { id_user, name_er, phone_er } = req.body.data;
        let _sql = '';
        let _arr = [];
        let changedRows;

        if(req.body.work_hour){
            let work_hour = JSON.stringify(req.body.work_hour)
            _sql = `UPDATE employee SET name_er = ?, phone_er = ?, working_hours = ? WHERE id_user = ?`;
            _arr = [name_er, phone_er, work_hour, id_user];
        } else {
            _sql = `UPDATE employee SET name_er = ?, phone_er = ? WHERE id_user = ?`;
            _arr = [name_er, phone_er, id_user];
        }
        connection.con.query(_sql, _arr, (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                changedRows = result.changedRows
                    const sql_data = `SELECT * FROM employee WHERE id_user = ?`;
                        connection.con.query(sql_data, id_user, (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                    //éxito al modificar y recargar datos empleado
                                    res.send({status: 1, data: result, changedRows: changedRows});
                            }
                        })
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Actualiza los permisos de un rol
router.post('/update-role-permissions', auth.verifyToken, async function(req, res, next){
    try {
        let {id, icon_role, name_role, list_of_permissions} = req.body;

        const _sql = `UPDATE role SET name_role= ?, icon_role= ?, list_of_permissions= ? WHERE id = ?`;
        connection.con.query(_sql, [name_role, icon_role, list_of_permissions, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                res.send({status: 1, data: result})
            }
        })
    } catch (error) {
        res.send({status: 0, error: error});
    }
    connection.con.end;
});


/* ----------------------- GET --------------------------*/

// Devuelve una empresa del listado
router.post('/get-enterprise', auth.verifyToken, async function(req, res, next){
    try{
        let {id} = req.body;
        const sql = `SELECT * FROM enterprise WHERE id = ?`;
        connection.con.query(sql, id, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Devuelve una lista de usuarios de una empresa en particular
router.post('/get-employees', auth.verifyToken, async function(req, res, next){
    try{
        let {id_enterprise} = req.body;
        const sql = `SELECT U.id, U.email, U.state AS verify, (SELECT COUNT(*) FROM employee AS E WHERE E.id_user = U.id) AS "is_employee" FROM users AS U WHERE U.id_enterprise = ?`;
        connection.con.query(sql, id_enterprise, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});

// Devuelve un empleado del listado
router.post('/get-employee', auth.verifyToken, async function(req, res, next){
    try{
        let {id_user} = req.body;
        const sql = `SELECT e.id, e.id_user, e.id_enterprise, e.name, e.email, e.address, e.date, e.phone, e.mobile, e.working_hours, e.name_er, e.phone_er, e.state, r.name_role, r.list_of_permissions 
                    FROM employee AS e INNER JOIN role AS r ON e.role = r.id 
                    WHERE id_user = ?`;
        connection.con.query(sql, id_user, (err, result, fields) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                if(result.length){
                    res.send({status: 1, data: result});
                } else{
                    res.send({status: 1, data: ''});
                }
            }
        });
    } catch(error){
        //error de conexión
        res.send({status: 0, error: error});
    }
    connection.con.end;
});


    // Facturación

        // Devuelve el número total de facturas por id para paginador
        router.post('/get-count-bills', auth.verifyToken, async function(req, res, next){
            try{
                let {id} = req.body;
                const sql = `SELECT COUNT(*) as total FROM bills WHERE id_enterprise = ?`;
                connection.con.query(sql, id, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve una lista de facturas de la empresa en cuestión
        router.post('/get-bills', auth.verifyToken, async function(req, res, next){
            try{
                let {id, page, size} = req.body;
                const sql = `SELECT * FROM bills WHERE id_enterprise = ? LIMIT ? OFFSET ?`;
                connection.con.query(sql, [id, size, size*page], (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

    // -----------------------------------


    // Productos

        // Devuelve el número total de productos por id_enterprise para paginador
        router.post('/get-count-products', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT COUNT(*) as total FROM product WHERE id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve una lista de productos de l empresa(id_enterprise)
        router.post('/get-products', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, page, size} = req.body;
                const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color 
                            FROM product AS p INNER JOIN categories AS c ON p.category = c.id 
                            WHERE p.id_enterprise = ?
                            LIMIT ? 
                            OFFSET ?`;
                connection.con.query(sql, [id_enterprise, size, size*page], (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve datos específicos de la tabla productos
        router.post('/get-products-data', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, date_limit} = req.body;
                const sql = `SELECT *
                            FROM (
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.is_stock = 'con stock' AND p.id_enterprise = ?
                                UNION
                                SELECT FORMAT(SUM(p.sale_price), 2) FROM product as p WHERE p.is_stock = 'con stock' AND p.id_enterprise = ?
                                UNION
                                SELECT CAST(COUNT(p.id) AS CHAR) FROM product as p WHERE p.sale_date > ? AND p.is_stock = 'sin stock' AND p.id_enterprise = ?
                                UNION
                                SELECT FORMAT(SUM(p.sale_price), 2) FROM product as p WHERE p.sale_date < ? AND p.is_stock = 'con stock' AND p.id_enterprise = ?
                            ) AS results`;
                connection.con.query(sql, [id_enterprise, id_enterprise, date_limit, id_enterprise, date_limit, id_enterprise], (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve el listado de las categorías
        router.post('/get-categories', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT * FROM categories WHERE id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

    // -----------------------------------


    // Roles

        // Devuelve el número total de usuarios por id para paginador
        router.post('/get-count-users', auth.verifyToken, async function(req, res, next){
            try{
                let {id} = req.body;
                const sql = `SELECT COUNT(*) as total FROM users WHERE id_enterprise = ?`;
                connection.con.query(sql, id, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve los roles de cada empresa
        router.post('/get-enterprise-roles', auth.verifyToken, async function(req, res, next){
            try {
                let {id_enterprise} = req.body;
                const _sql = `SELECT * FROM role WHERE id_enterprise = ?`;
                connection.con.query(_sql, id_enterprise, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch (error) {
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve una lista de usuarios de la empresa en cuestión
        router.post('/get-enterprise-users', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise} = req.body;
                const sql = `SELECT u.email, u.thumbnail, u.state AS verified_state,
                            (SELECT e.id FROM employee AS e WHERE e.id_user = u.id) AS id_employee, 
                            (SELECT e.name FROM employee AS e WHERE e.id_user = u.id) AS name_employee, 
                            (SELECT r.name_role FROM employee AS e INNER JOIN role AS r ON e.role = r.id WHERE e.id_user = u.id) AS role, 
                            (SELECT e.state FROM employee AS e WHERE e.id_user = u.id) AS state_employee 
                            FROM users AS u 
                            WHERE u.id_enterprise = ?`;
                connection.con.query(sql, id_enterprise, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        //Devuelve el listado de permisos de la tabla permissions
        router.get('/get-permissions', async function(req, res, next){
            try{
                const _sql = `SELECT * FROM permissions`;
                connection.con.query(_sql, (err, result, fields) => {
                    if(err){
                        res.send({status: 0, data: err});
                    } else{
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Devuelve los permisos de un rol en particular, utilizando el id de ese rol de esa empresa
        router.post('/get-role-permissions', auth.verifyToken, async function(req, res, next){
            try {
                let {id_role} = req.body;
                const _sql = `SELECT * FROM role WHERE id = ?`;
                connection.con.query(_sql, id_role, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        if(result.length){
                            res.send({status: 1, data: result});
                        } else{
                            res.send({status: 1, data: ''});
                        }
                    }
                });
            } catch (error) {
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Crear un nuevo rol para una empresa
        router.post('/create-new-role', auth.verifyToken, async function(req, res, next){
            try{
                let {id_enterprise, name_role, icon_role} = req.body;
                const sql = `INSERT INTO role(id_enterprise, name_role, icon_role) VALUES (?, ?, ?)`;
                connection.con.query(sql, [id_enterprise, name_role, icon_role], (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        res.send({status: 1, data: result});
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

        // Elimina un rol de una empresa
        router.post('/delete-role', auth.verifyToken, async function(req, res, next){
            try{
                let {id} = req.body;
                const sql = `DELETE FROM role WHERE id = ?`;
                connection.con.query(sql, id, (err, result, fields) => {
                    if (err) {
                        res.send({status: 0, data: err});
                    } else {
                        res.send({status: 1, data: result});
                    }
                });
            } catch(error){
                //error de conexión
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

    // -----------------------------------

module.exports = router;