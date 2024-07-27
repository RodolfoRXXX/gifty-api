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
router.post('/update-user-image', auth.verifyToken, async (req, res, next) => {
    try {
        let {id, thumbnail, prev_thumb} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id, 'user', 'thumbnail', thumbnail, 350, 350, prev_thumb)
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
        const sql_data = `SELECT u.*, e.name AS enterprise, e.thumbnail AS enterprise_thumbnail
                            FROM users AS u 
                            INNER JOIN enterprise AS e ON u.id_enterprise = e.id 
                            WHERE u.id = ?`;
        connection.con.query(sql_data, id, (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                let user = [{id: result[0].id, name: result[0].name, email: result[0].email, password: result[0].password, thumbnail: thumbnail, id_enterprise: result[0].id_enterprise, enterprise: result[0].enterprise, enterprise_thumbnail: result[0].enterprise_thumbnail, activation_code: result[0].activation_code, state: result[0].state}]
                let token = jwt.sign({data: user}, keys.key);
                if(prev_thumb !== thumbnail) {
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
router.post('/update-enterprise-image', auth.verifyToken, async (req, res, next) => {
    try {
        let {id, thumbnail, prev_thumb} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id, 'enterprise', 'thumbnail', thumbnail, 350, 350, prev_thumb)
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
        if(prev_thumb !== thumbnail) {
            const sql = `UPDATE enterprise SET thumbnail = ? WHERE id = ?`;
            connection.con.query(sql, [thumbnail, id], (err, result, field) => {
                if (err) {
                    res.send({status: 0, data: err});
                } else {
                    changedRows = result.changedRows
                    res.send({status: 1, data: thumbnail, changedRows: changedRows});
                }
            })
        } else {
            changedRows = 1
            res.send({status: 1, data: thumbnail, changedRows: changedRows});
        }
    } catch (error) {
        res.send({status: 0, data: '', data: error});
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
        let {id, name, date, email, address, phone, mobile, city, state, country } = req.body;
        const _sql = `UPDATE employee 
                        SET name = ?, date = ?, email = ?, address = ?, phone = ?, mobile = ?, city = ?, state = ?, country = ? 
                        WHERE id = ?`;
        const _arr = [name, date, email, address, phone, mobile, city, state, country, id];
        let changedRows;
            connection.con.query(_sql, _arr, (err, result, field) => {
                if (err) {
                    res.send({status: 0, data: err});
                } else {
                    changedRows = result.changedRows
                    const sql_data = `SELECT * FROM employee WHERE id = ?`;
                        connection.con.query(sql_data, id, (err, result, field) => {
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
        let { id } = req.body.data;
        let changedRows;

        let work_hour = JSON.stringify(req.body.work_hour)
        const _sql = `UPDATE employee SET working_hours = ? WHERE id = ?`;
        connection.con.query(_sql, [work_hour, id], (err, result, field) => {
            if (err) {
                res.send({status: 0, data: err});
            } else {
                changedRows = result.changedRows
                    const sql_data = `SELECT * FROM employee WHERE id = ?`;
                        connection.con.query(sql_data, id, (err, result, field) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                    //éxito al modificar y recargar datos
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

// Actualiza los valores de un empleado (contactos de emergencia)
router.post('/update-employee-er-contact', auth.verifyToken, async function(req, res, next){
    try {
        let {id, name_er, phone_er } = req.body;
        const _sql = `UPDATE employee 
                        SET name_er = ?, phone_er = ? 
                        WHERE id = ?`;
        let changedRows;
            connection.con.query(_sql, [name_er, phone_er, id], (err, result, field) => {
                if (err) {
                    res.send({status: 0, data: err});
                } else {
                    changedRows = result.changedRows
                    const sql_data = `SELECT * FROM employee WHERE id = ?`;
                        connection.con.query(sql_data, id, (err, result, field) => {
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

        //Empresa
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

            // Devuelve un empleado por ID de usuario
            router.post('/get-employee', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_user} = req.body;
                    const sql = `SELECT e.*, r.name_role, r.list_of_permissions 
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

            // Devuelve datos específicos de cada enterprise PENDIENTE!!!
            router.post('/get-enterprise-data', auth.verifyToken, async function(req, res, next){
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

            // Actualiza el campo de clasificación 2
            router.post('/update-enterprise-option2', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, name} = req.body;

                    const sql = `UPDATE enterprise SET name_option2 = ? WHERE id = ?`;
                    connection.con.query(sql, [name, id], (err, result, field) => {
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

            // Devuelve el listado de las opciones 1 (Color)
            router.post('/get-option1', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT * FROM table_option_1 WHERE id_enterprise = ?`;
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

            // Devuelve el listado de las opciones 2 (Medida)
            router.post('/get-option2', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT * FROM table_option_2 WHERE id_enterprise = ?`;
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

            // Actualiza el campo de clasificación 1
            router.post('/update-enterprise-tableOption1', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, id_enterprise, name} = req.body;
                    let sql;
                    let arr;

                    if(id == 0) {
                        //Creando un nuevo valor
                        sql = `INSERT INTO table_option_1 (id_enterprise, name) VALUES (?, ?)`;
                        arr = [id_enterprise, name];
                    } else {
                        //Editando un valor
                        sql = `UPDATE table_option_1 SET name = ? WHERE id = ?`;
                        arr = [name, id];
                    }

                    connection.con.query(sql, arr, (err, result, field) => {
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

            // Actualiza el campo de clasificación 2
            router.post('/update-enterprise-tableOption2', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, id_enterprise, name} = req.body;
                    let sql;
                    let arr;

                    if(id == 0) {
                        //Creando un nuevo valor
                        sql = `INSERT INTO table_option_2 (id_enterprise, name) VALUES (?, ?)`;
                        arr = [id_enterprise, name];
                    } else {
                        //Editando un valor
                        sql = `UPDATE table_option_2 SET name = ? WHERE id = ?`;
                        arr = [name, id];
                    }

                    connection.con.query(sql, arr, (err, result, field) => {
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


        //Remitos/Pedidos
            // Devuelve datos específicos de la tabla pedidos
            router.post('/get-orders-data', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit} = req.body;
                    const sql = `SELECT 
                                COUNT(CASE WHEN o.status = 2 THEN 1 END) as d2,
                                COUNT(CASE WHEN o.status = 1 AND o.date > ? THEN 1 END) as d1,
                                COUNT(CASE WHEN o.status = 5 AND o.date > ? THEN 1 END) as d5,
                                COUNT(CASE WHEN o.status = 4 AND o.date > ? THEN 1 END) as d4
                                    FROM 
                                        orders as o
                                    WHERE 
                                        o.id_enterprise = ?`;
                    connection.con.query(sql, [date_limit, date_limit, date_limit, id_enterprise], (err, result, fields) => {
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

            // Devuelve el número total de pedidos por id_enterprise para paginador
            router.post('/get-count-orders', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT COUNT(*) as total FROM orders WHERE id_enterprise = ?`;
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

            // Devuelve una lista de pedidos de la empresa(id_enterprise)
            router.post('/get-orders', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, page, size} = req.body;
                    const sql = `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.thumbnail AS customer_thumbnail 
                                FROM orders AS o INNER JOIN customer AS c ON o.customer = c.id 
                                WHERE o.id_enterprise = ?
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

            // Devuelve un remito por ID solamente
            router.post('/get-order-detail-by-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_order} = req.body;
                    const sql = `SELECT o.*,
                                e.name AS e_name, e.email AS e_email, e.address AS e_address, e.phone_1 as e_phone, e.cuit as e_cuit, e.city as e_city, e.state as e_state, e.country as e_country, e.cp as e_cp,
                                c.name as c_name, c.email as c_email, c.phone as c_phone, c.mobile as c_mobile, c.address as c_address, c.city as c_city, c.state as c_state, c.country as c_country 
                                FROM orders AS o 
                                INNER JOIN enterprise AS e ON o.id_enterprise = e.id 
                                INNER JOIN customer AS c ON o.customer = c.id 
                                WHERE o.id = ?`;
                    connection.con.query(sql, id_order, (err, result, fields) => {
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

            // Devuelve una lista de productos del remito abierto donde paso los ids de los productos
            router.post('/get-products-by-order', auth.verifyToken, async function(req, res, next){
                try{
                    let {detail} = req.body;
                    const placeholders = detail.map(() => '?').join(',');
                    const sql = `SELECT p.*
                                FROM product AS p
                                WHERE p.id IN (${placeholders})`;
                    connection.con.query(sql, detail, (err, result, fields) => {
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

            //Devuelve opciones de productos para agregar un producto nuevo a un remito de acuerdo al texto ingresado
            router.post('/get-products-options', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, text} = req.body;
                    const sql = `SELECT p.id, p.name, p.description, p.image, p.sale_price, p.sku, p.state, p.stock_available, t1.name AS option_1_name, t2.name AS option_2_name 
                                FROM product AS p
                                INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id
                                INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                                WHERE p.name LIKE ? AND p.id_enterprise = ?
                                ORDER BY name`;
                    connection.con.query(sql, [`${text}%`, id_enterprise], (err, result, fields) => {
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

            //Devuelve opciones de CLIENTES para agregar un cliente ya existente a un remito abierto
            router.post('/get-customer-options', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, text} = req.body;
                    const sql = `SELECT *
                                FROM customer AS c
                                WHERE c.name LIKE ? AND c.id_enterprise = ?
                                ORDER BY name`;
                    connection.con.query(sql, [`${text}%`, id_enterprise], (err, result, fields) => {
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

            //Actualiza el remito elegido y el stock disponible de sus productos si es que se realizan dichos cambios
            router.post('/update-order-detail', auth.verifyToken, async function(req, res, next) {
                const { form: { id, customer, detail, shipment, observation }, edit: editRegister } = req.body;
              
                async function updateOrdersAndProducts(conect, id, customer, detail, shipment, observation, editRegister) {
                    return new Promise((resolve, reject) => {
                        // Consulta de actualización para la tabla "orders"
                        let orderUpdates = [];
                            (customer != 0)?orderUpdates.push('customer = ?'):'';
                            (detail != '')?orderUpdates.push('detail = ?'):'';
                            (shipment != '')?orderUpdates.push('shipment = ?'):'';
                            (observation != '')?orderUpdates.push('observation = ?'):'';
                        
                        let orderValues = [];
                            (customer != 0)?orderValues.push(customer):'';
                            (detail != '')?orderValues.push(detail):'';
                            (shipment != '')?orderValues.push(shipment):'';
                            (observation != '')?orderValues.push(observation):'';
                            orderValues.push(id);


                        let orderQuery = `UPDATE orders SET ${orderUpdates.join(', ')} WHERE id = ?`;
              
                        conect.query(orderQuery, orderValues, (err, results) => {
                            if (err) {
                                return conect.rollback(() => {
                                    reject(err);
                                });
                            }
                
                            if (editRegister && editRegister.length > 0) {
                            // Construir las consultas de actualización para la tabla "product"
                            let productQueries = [];
                            editRegister.forEach(product => {
                                productQueries.push(
                                new Promise((resolve, reject) => {
                                    let productQuery = `UPDATE product SET stock_available = (stock_available - ?) WHERE id = ?`;
                                    conect.query(productQuery, [product.editQty, product.id_product], (err, results) => {
                                        if (err) return reject(err);
                                        resolve(results);
                                    });
                                })
                                );
                            });
                
                            Promise.all(productQueries)
                                .then(() => {
                                    conect.commit(err => {
                                        if (err) {
                                            return conect.rollback(() => {
                                                reject(err);
                                            });
                                        }
                                        resolve(results);
                                    });
                                })
                                .catch(err => {
                                    conect.rollback(() => {
                                        reject(err);
                                    });
                                });
                            } else {
                                conect.commit(err => {
                                    if (err) {
                                        return conect.rollback(() => {
                                            reject(err);
                                        });
                                    }
                                    resolve(results);
                                });
                            }
                        });
                    });
                }
              
                connection.con.getConnection((err, conect) => {
                  if (err) {
                    res.send({status: 0, error: err});
                    return;
                  }
              
                  updateOrdersAndProducts(conect, id, customer, detail, shipment, observation, editRegister)
                    .then( response  => {
                      res.send({status: 1, data: response});
                    })
                    .catch(err => {
                      res.send({status: 0, error: err});
                    })
                    .finally(() => {
                      conect.release();
                    });
                });
            });

        
        // Clientes
            //Crea un nuevo cliente
            router.post('/create-customer', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, name, cuit, email, phone, mobile, address, city, state, country, status} = req.body;
                    const sql_e = `SELECT name FROM customer WHERE name = ?;`
                    connection.con.query(sql_e, name, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            if (!result.length) {
                                //éxito en no encontrar esta categoría
                                const sql = `INSERT INTO customer(id_enterprise, name, cuit, email, phone, mobile, address, city, state, country, status, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
                                connection.con.query(sql, [id_enterprise, name, cuit, email, phone, mobile, address, city, state, country, status], (err, response, fields) => {
                                    if (err) {
                                        //error de conexion o para crear la categoría
                                        res.send({status: 0, data: err});
                                    } else {
                                        let client = [{id: result.insertId, id_enterprise: id_enterprise, thumbnail: 'no-image.png', name: name, cuit: cuit, email: email, phone: phone, mobile: mobile, address: address, city: city, state: state, country: country, status: status}];
                                        res.send({status: 1, data: response, client: client})
                                    }
                                })
                            } else{
                                //error porque existe la categoría
                                res.send({status: 1, data: 'existente'});
                            }
                        }
                    });
                } catch(error){
                    //error de conexión
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

            // Devuelve el cliente buscado por ID
            router.post('/get-customer-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_customer} = req.body;
                    const sql = `SELECT * FROM customer WHERE id = ?`;
                    connection.con.query(sql, id_customer, (err, result, fields) => {
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


        // Productos
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

            // Devuelve una lista de productos de la empresa(id_enterprise)
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

            // Devuelve una lista de productos de la empresa para crear uno nuevo(id_enterprise)
            router.post('/get-products-listOfName', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT p.name, p.category 
                                FROM product AS p 
                                WHERE p.id_enterprise = ?
                                ORDER BY p.name`;
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

            // Devuelve un producto por id_enterprise, name, id_option_1, id_option_2
            router.post('/get-product-detail', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, name, id_option_1, id_option_2} = req.body;
                    const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color , s.name AS storage_name, prov.name AS provider_name, t1.name AS option_1_name, t2.name AS option_2_name 
                                FROM product AS p INNER JOIN categories AS c ON p.category = c.id 
                                INNER JOIN storage AS s ON p.storage_location = s.id 
                                INNER JOIN provider AS prov ON p.provider = prov.id
                                INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                                INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id  
                                WHERE p.id_enterprise = ? AND p.name = ? AND p.id_option_1 = ? AND p.id_option_2 = ?`;
                    connection.con.query(sql, [id_enterprise, name, id_option_1, id_option_2], (err, result, fields) => {
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

            // Devuelve las variantes de opciones del mismo producto
            router.post('/get-product-variants', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, name} = req.body;
                    const sql = `SELECT p.*,  t1.name AS option_1_name, t2.name AS option_2_name
                                FROM product AS p 
                                INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                                INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                                WHERE p.id_enterprise = ? AND p.name = ?`;
                    connection.con.query(sql, [id_enterprise, name], (err, result, fields) => {
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

            // Devuelve un producto por ID solamente
            router.post('/get-product-detail-by-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_product} = req.body;
                    const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color, s.name AS storage_name, prov.name AS provider_name, t1.name AS option_1_name, t2.name AS option_2_name 
                                FROM product AS p INNER JOIN categories AS c ON p.category = c.id
                                INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                                INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                                INNER JOIN storage AS s ON p.storage_location = s.id 
                                INNER JOIN provider AS prov ON p.provider = prov.id 
                                WHERE p.id = ?`;
                    connection.con.query(sql, id_product, (err, result, fields) => {
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

            // Devuelve la cantidad de un mismo producto pero para diferentes valores del campo "id_option_1" (DEPRECATED en product-detail)
            router.post('/get-product-detail-option1', auth.verifyToken, async function(req, res, next){
                try{
                    let {name, id_enterprise} = req.body;
                    const sql = `SELECT p.id_option_1 AS id_option, t1.name AS option, SUM(p.stock_real) AS stock 
                                FROM product AS p 
                                INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                                WHERE p.name = ? AND p.id_enterprise = ? 
                                GROUP BY p.id_option_1 
                                HAVING COUNT(DISTINCT p.id_option_1) > 0;`;
                    connection.con.query(sql, [name, id_enterprise], (err, result, fields) => {
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

            // Devuelve la cantidad de un mismo producto pero para diferentes valores del campo "id_option_2" (DEPRECATED en product-detail)
            router.post('/get-product-detail-option2', auth.verifyToken, async function(req, res, next){
                try{
                    let {name, id_enterprise} = req.body;
                    const sql = `SELECT p.id_option_2 AS id_option, t2.name AS option, SUM(p.stock_real) AS stock 
                                FROM product AS p 
                                INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                                WHERE p.name = ? AND p.id_enterprise = ? 
                                GROUP BY p.id_option_2 
                                HAVING COUNT(DISTINCT p.id_option_2) > 0;`;
                    connection.con.query(sql, [name, id_enterprise], (err, result, fields) => {
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

            // Verifica si un SKU existe
            router.post('/test-sku', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, sku} = req.body;
                    const sql = `SELECT * FROM product AS p WHERE p.id_enterprise = ? AND p.sku = ?`;
                    connection.con.query(sql, [id_enterprise, sku], (err, result, fields) => {
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

            // Devuelve un producto por ID o un conjunto por nombre
            router.post('/get-product-id-name', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_product, name, id_enterprise} = req.body;
                    let sql;
                    let arr;
                    if(id_product > 0) {
                        //busca por ID
                        sql = `SELECT p.name, p.description, p.image, t1.name AS option_1, t2.name AS option_2 
                                FROM product AS p 
                                INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                                INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                                WHERE p.id = ?`;
                                arr = [id_product];
                    } else if(name.length > 0) {
                        //Busca por name
                        sql = `SELECT p.name, p.description, p.image, t1.name AS option_1, t2.name AS option_2 
                                FROM product AS p 
                                INNER JOIN table_option_1 AS t1 ON p.id_option_1 = t1.id 
                                INNER JOIN table_option_2 AS t2 ON p.id_option_2 = t2.id 
                                WHERE p.id_enterprise = ? AND p.name LIKE CONCAT('p', '%')`;
                                arr = [id_enterprise, name];
                    }
                    connection.con.query(sql, arr, (err, result, fields) => {
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


            //Editar campos de un producto
                //Crea un producto nuevo pero solo la parte de información básica de producto
                router.post('/create-product', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id_enterprise, name, description, category, id_option_1, id_option_2, sku } = req.body;

                        const sql = `INSERT INTO product(id_enterprise, image, name, description, category, id_option_1, id_option_2, sku, stock_real, is_stock, stock_available, storage_location, sale_price, purchase_price, provider, purchase_date, sale_date, state) 
                                    VALUES (?,'no-image.png',?,?,?,?,?,?,0 ,'sin stock',0,1,0.00,0.00,1,'','','inactivo')`;
                        connection.con.query(sql, [id_enterprise, name, description, category, id_option_1, id_option_2, sku], (err, result, field) => {
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

                //Edita un producto, pero los campos de información básica
                router.post('/edit-product-information', auth.verifyToken, async function(req, res, next){
                    try {
                        let {name, description, category, id_option_1, id_option_2, sku, id, id_enterprise} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET name=?,description=?,category=?,id_option_1=?,id_option_2=?,sku=? WHERE p.id = ?`;
                        connection.con.query(sql, [name, description, category, id_option_1, id_option_2, sku, id], (err, result, field) => {
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

                // Edita una imagen para un producto por ID
                router.post('/edit-product-image', auth.verifyToken, async (req, res, next) => {
                    try {
                        let {id, image, prev_thumb} = req.body;
                        let changedRows;

                        if(image.includes(';base64,')){
                            await save_image(id, 'product', 'picture', image, 600, 600, prev_thumb)
                            .then( value => {
                                if(value == 'error') throw 'error';
                                else {
                                    image = value;
                                }
                            } )
                            .catch( error => {
                                throw error;
                            } )
                        }

                        if(prev_thumb !== image) {
                            const sql = `UPDATE product SET image = ? WHERE id = ?`;
                            connection.con.query(sql, [image, id], (err, result, field) => {
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

                //Edita un producto, pero los campos de proveedor, fehca de compra y precio de compra
                router.post('/edit-product-provider', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, provider, purchase_date, purchase_price} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET provider=?, purchase_date=?, purchase_price=? WHERE p.id = ?`;
                        connection.con.query(sql, [provider, purchase_date, purchase_price, id], (err, result, field) => {
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

                //Edita un producto, pero los campos de stock_real, stock_available y is_stock
                router.post('/edit-product-stock', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, stock_real, is_stock, stock_available} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET stock_real=?, is_stock=?, stock_available=? WHERE p.id = ?`;
                        connection.con.query(sql, [stock_real, is_stock, stock_available, id], (err, result, field) => {
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

                //Edita un producto, pero el campo de sale_price
                router.post('/edit-product-price', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, sale_price, purchase_price} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET sale_price=? WHERE p.id = ?`;
                        connection.con.query(sql, [sale_price, id], (err, result, field) => {
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

                //Edita un producto, pero el campo de storage_location
                router.post('/edit-product-storage', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, storage_location} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET storage_location=? WHERE p.id = ?`;
                        connection.con.query(sql, [storage_location, id], (err, result, field) => {
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

                //Activa o desactiva un producto
                router.post('/edit-product-activation', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, state} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET state=? WHERE p.id = ?`;
                        connection.con.query(sql, [state, id], (err, result, field) => {
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


        //Categorías
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

            // Devuelve una categoría por ID
            router.post('/get-category-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_category} = req.body;
                    const sql = `SELECT * FROM categories WHERE id = ?`;
                    connection.con.query(sql, id_category, (err, result, fields) => {
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

            // Devuelve el listado de las categorías con stock y precio del total de cada categoría
            router.post('/get-categories-stock-price', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT c.*,
                                COALESCE(SUM(p.stock_real), 0) AS total_stock_real,
                                COALESCE(SUM(CASE WHEN p.stock_real > 0 THEN p.sale_price ELSE 0 END), 0) AS total_sale_price 
                                FROM categories AS c 
                                LEFT JOIN product AS p ON c.id = p.category 
                                WHERE c.id_enterprise = ? 
                                GROUP BY c.id
                                ORDER BY c.name`;
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

            // Crea una categoría nueva
            router.post('/create-category', auth.verifyToken, async function(req, res, next){
                try{
                    let {id, id_enterprise, name, color_badge, color} = req.body;
                    const sql_e = `SELECT name FROM categories WHERE name = ?;`
                    connection.con.query(sql_e, name, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            if (!result.length) {
                                //éxito en no encontrar esta categoría
                                const sql = `INSERT INTO categories(id_enterprise, name, color_badge) VALUES (?, ?, ?)`;
                                connection.con.query(sql, [id_enterprise, name, color_badge], (err, response, fields) => {
                                    if (err) {
                                        //error de conexion o para crear la categoría
                                        res.send({status: 0, data: err});
                                    } else {
                                        res.send({status: 1, data: response})
                                    }
                                })
                            } else{
                                //error porque existe la categoría
                                res.send({status: 1, data: 'existente'});
                            }
                        }
                    });
                } catch(error){
                    //error de conexión
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

            // Edita una categoría
            router.post('/edit-category', auth.verifyToken, async function(req, res, next){
                try{
                    let {id, id_enterprise, name, color_badge, color} = req.body;
                    const sql = `UPDATE categories AS c
                                SET name=?,color_badge=?
                                WHERE c.id = ?`;
                    connection.con.query(sql, [name, color_badge, id], (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            res.send({status: 1, data: result})
                        }
                    });
                } catch(error){
                    //error de conexión
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });


        //Storages
            // Devuelve el número total de facturas por id para paginador
            router.post('/get-count-storages', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT COUNT(*) as total FROM storage WHERE id_enterprise = ?`;
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

            // Devuelve el listado de los depósitos
            router.post('/get-storages', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT * FROM storage WHERE id_enterprise = ?`;
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

            // Devuelve un depósitos por ID
            router.post('/get-storage-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_storage} = req.body;
                    const sql = `SELECT * FROM storage WHERE id = ?`;
                    connection.con.query(sql, id_storage, (err, result, fields) => {
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

            // Devuelve datos específicos de la tabla storage
            router.post('/get-storage-data', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, id_storage} = req.body;
                    const sql = `SELECT * FROM ( 
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.is_stock = 'con stock' AND p.storage_location = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT FORMAT(SUM(p.sale_price), 2) FROM product as p WHERE p.is_stock = 'con stock' AND p.storage_location = ? AND p.id_enterprise = ? ) 
                                AS results`;
                    connection.con.query(sql, [id_storage, id_enterprise, id_storage, id_enterprise], (err, result, fields) => {
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


            //Editar campos de un storage
                //Crea un depósito nuevo
                router.post('/create-storage', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id_enterprise, name, phone, address, city, state, country} = req.body;
                        const sql_e = `SELECT name FROM storage WHERE name = ?;`
                        connection.con.query(sql_e, name, (err, result, fields) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                if (!result.length) {
                                    //éxito en no encontrar este depósito
                                    const sql = `INSERT INTO storage (id_enterprise, name, phone, address, city, state, country, status)
                                                VALUES (?,?,?,?,?,?,?, 0);`;
                                    connection.con.query(sql, [id_enterprise, name, phone, address, city, state, country], (err, response, fields) => {
                                        if (err) {
                                            //error de conexion o para crear el depósito
                                            res.send({status: 0, data: err});
                                        } else {
                                            res.send({status: 1, data: response})
                                        }
                                    })
                                } else{
                                    //error porque existe depósito
                                    res.send({status: 1, data: 'existente'});
                                }
                            }
                        });


                    } catch (error) {
                        res.send({status: 0, error: error});
                    }
                    connection.con.end;
                });

                // Edita un storage
                router.post('/edit-storage', auth.verifyToken, async function(req, res, next){
                    try{
                        let {id, name, phone, address, city, state, country} = req.body;
                        const sql = `UPDATE storage AS s
                                    SET name=?, phone=?, address=?, city=?, state=?, country=?
                                    WHERE s.id = ?`;
                        connection.con.query(sql, [name, phone, address, city, state, country, id], (err, result, fields) => {
                            if (err) {
                                res.send({status: 0, data: err});
                            } else {
                                res.send({status: 1, data: result})
                            }
                        });
                    } catch(error){
                        //error de conexión
                        res.send({status: 0, error: error});
                    }
                    connection.con.end;
                });

                //Activa o desactiva un storage
                router.post('/edit-storage-activation', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, status} = req.body;

                        const sql = `UPDATE storage AS s 
                                    SET status=? WHERE s.id = ?`;
                        connection.con.query(sql, [status, id], (err, result, field) => {
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


        //Providers
            // Devuelve el número total de facturas por id para paginador
            router.post('/get-count-providers', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT COUNT(*) as total FROM provider WHERE id_enterprise = ?`;
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

            // Devuelve el listado de las proveedores
            router.post('/get-providers', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT * FROM provider WHERE id_enterprise = ?`;
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

            // Devuelve un proveedor por ID
            router.post('/get-provider-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_provider} = req.body;
                    const sql = `SELECT * FROM provider WHERE id = ?`;
                    connection.con.query(sql, id_provider, (err, result, fields) => {
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

            //Crea un proveedor nuevo
            router.post('/create-provider', auth.verifyToken, async function(req, res, next){
                try {
                    let {id_enterprise, name, phone, whatsapp, email, address, country } = req.body;
                    const sql_e = `SELECT name FROM provider WHERE name = ?;`
                    connection.con.query(sql_e, name, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            if (!result.length) {
                                //éxito en no encontrar este proveedor
                                const sql = `INSERT INTO provider (id_enterprise, name, phone, whatsapp, email, address, country, created)
                                            VALUES (?,?,?,?,?,?,?, NOW());`;
                                connection.con.query(sql, [id_enterprise, name, phone, whatsapp, email, address, country], (err, response, fields) => {
                                    if (err) {
                                        //error de conexion o para crear el proveedor
                                        res.send({status: 0, data: err});
                                    } else {
                                        res.send({status: 1, data: response})
                                    }
                                })
                            } else{
                                //error porque existe proveedor
                                res.send({status: 1, data: 'existente'});
                            }
                        }
                    });


                } catch (error) {
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

            // Edita un proveedor
            router.post('/edit-provider', auth.verifyToken, async function(req, res, next){
                try{
                    let {id, name, phone, whatsapp, email, address, country} = req.body;
                    const sql = `UPDATE provider AS p
                                SET name=?, phone=?, whatsapp=?, email=?, address=?, country=?
                                WHERE p.id = ?`;
                    connection.con.query(sql, [name, phone, whatsapp, email, address, country, id], (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            res.send({status: 1, data: result})
                        }
                    });
                } catch(error){
                    //error de conexión
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

            // Devuelve datos específicos de la tabla productos
            router.post('/get-provider-data', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, id_provider} = req.body;
                    const sql = `SELECT * FROM ( 
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.is_stock = 'con stock' AND p.provider = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT FORMAT(SUM(p.purchase_price), 2) FROM product as p WHERE p.is_stock = 'con stock' AND p.provider = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT MAX(STR_TO_DATE(purchase_date, '%Y-%m-%d')) FROM product AS p WHERE p.is_stock = 'con stock' AND p.provider = ? AND p.id_enterprise = ?
                                ) AS results`;
                    connection.con.query(sql, [id_provider, id_enterprise, id_provider, id_enterprise, id_provider, id_enterprise], (err, result, fields) => {
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
                            (SELECT r.icon_role FROM employee AS e INNER JOIN role AS r ON e.role = r.id WHERE e.id_user = u.id) AS icon_role, 
                            (SELECT e.status FROM employee AS e WHERE e.id_user = u.id) AS state_employee 
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