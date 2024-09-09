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
const generateNumber = require('../functions/generateNumber');

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
                //éxito al modificar usuario
                changedRows = result.changedRows;
                res.send({status: 1, data: name, changedRows: changedRows});
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
        let {id, id_enterprise, thumbnail, prev_thumb} = req.body;
        let changedRows;

        if(thumbnail.includes(';base64,')){
            await save_image(id_enterprise, id, 'user', 'thumbnail', thumbnail, 350, 350, prev_thumb)
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
            await save_image(id, id, 'enterprise', 'thumbnail', thumbnail, 350, 350, prev_thumb)
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
                res.send({status: 1, data: result, name: name})
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
                    res.send({status: 1, data: result, name: name});
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

            // Devuelve un empleado por ID de empleado
            router.post('/get-employee-ID', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_employee} = req.body;
                    const sql = `SELECT e.*, r.name_role, r.list_of_permissions 
                                FROM employee AS e INNER JOIN role AS r ON e.role = r.id 
                                WHERE e.id = ?`;
                    connection.con.query(sql, id_employee, (err, result, fields) => {
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

            // Devuelve un usuario por ID de user
            router.post('/get-user-ID', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_user} = req.body;
                    const sql = `SELECT * 
                                FROM users AS u
                                WHERE u.id = ?`;
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

            //Devuelve el listado de filtros
            router.post('/get-filters', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT 
                                    filter_name, 
                                    GROUP_CONCAT(filter_value ORDER BY filter_value SEPARATOR ',') AS filter_values
                                FROM 
                                    filters
                                WHERE id_enterprise = ?
                                GROUP BY 
                                    filter_name;`;
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

            //Devuelve el listado de filtros (PUEDE QUE REEMPLACE A LA FUNCIÓN DE ARRIBA) NO FILTRA POR ID_ENTERPRISE
            router.post('/get-filters-obj', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT filter_name, CONCAT('[', GROUP_CONCAT( JSON_OBJECT('id', id, 'value', filter_value) 
                                    ORDER BY filter_value SEPARATOR ', ' ), ']') AS filter_values 
                                FROM filters 
                                WHERE id_enterprise = ?
                                GROUP BY filter_name`;
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

            // Actualiza el campo de nombre de filtro
            router.post('/update-filter-name', auth.verifyToken, async function(req, res, next){
                try {
                    let {id_enterprise, filter_name, filter_value, last_filter_name} = req.body;
                    let sql;
                    let arr;

                    if(last_filter_name != '') {
                        //Actualiza a un valor existente
                        sql = `UPDATE filters
                                SET filter_name = ?
                                WHERE filter_name = ? AND id_enterprise = ?;`;
                        arr = [filter_name, last_filter_name, id_enterprise];
                    } else {
                        //Crea un valor nuevo
                        sql = `INSERT INTO filters(id_enterprise, filter_name, filter_value) VALUES (?, ?, ?)`;
                        arr = [id_enterprise, filter_name, filter_value];
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

            // Actualiza el campo de valor de filtro
            router.post('/update-filter-value', auth.verifyToken, async function(req, res, next){
                try {
                    let {id_enterprise, filter_name, filter_value, last_filter_value} = req.body;
                    let sql;
                    let arr;

                    if(last_filter_value != '') {
                        //Actualiza un valor existente
                        sql = `UPDATE filters
                                SET filter_value = ?
                                WHERE filter_name = ? AND filter_value = ? AND id_enterprise = ?;`;
                        arr = [filter_value, filter_name, last_filter_value, id_enterprise];
                    } else {
                        //Crea un nuevo valor
                        sql = `INSERT INTO filters(id_enterprise, filter_name, filter_value) VALUES (?, ?, ?)`;
                        arr = [id_enterprise, filter_name, filter_value];
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

        // Configuración - Data
            //Crear empleado nuevo
            router.post('/create-employee', auth.verifyToken, async function(req, res, next){
                try{
                    let {id, id_enterprise, role} = req.body;
                    const sql_e = `SELECT * FROM employee WHERE id_user = ?;`
                    connection.con.query(sql_e, id, (err, result, fields) => {
                        if (err) {
                            res.send({status: 0, data: err});
                        } else {
                            if (!result.length) {
                                //éxito en no encontrar el empleado
                                const sql = `INSERT INTO employee(id_user, id_enterprise, role, created) VALUES (?, ?, ?, NOW())`;
                                connection.con.query(sql, [id, id_enterprise, role], (err, response, fields) => {
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
                } catch (error) {
                    res.send({status: 0, error: error});
                }
                connection.con.end;
            });

            //Cambiar el estado del empleado
            router.post('/change-employee-state', auth.verifyToken, async function(req, res, next){
                try {
                    let {id_employee, status} = req.body;

                    const sql = `UPDATE employee SET status=? WHERE id = ?`;
                    connection.con.query(sql, [status, id_employee], (err, result, field) => {
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

            //Devuelve el total de ventas realizadas
            router.post('/get-user-pending', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT SUM(amount) AS response
                                FROM (
                                    SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].price'))) AS DECIMAL(10, 2)) AS amount
                                    FROM orders AS o
                                    JOIN (
                                        SELECT 0 AS i 
                                        UNION ALL SELECT 1 
                                        UNION ALL SELECT 2 
                                        UNION ALL SELECT 3 
                                        UNION ALL SELECT 4 
                                        UNION ALL SELECT 5 
                                        UNION ALL SELECT 6 
                                        UNION ALL SELECT 7 
                                        UNION ALL SELECT 8 
                                        UNION ALL SELECT 9
                                    ) AS idx 
                                    ON JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) IS NOT NULL
                                    WHERE o.id_enterprise = ? AND o.date > ? AND o.status = 1 ${seller_filter}
                                    AND JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) = '2'
                                ) AS subquery;`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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

            //Devuelve el total de ventas realizadas
            router.post('/get-user-open-orders', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT COUNT(*) AS response
                                FROM orders AS o 
                                WHERE o.id_enterprise = ? AND o.date > ? AND o.status = 1 ${seller_filter};`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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

            //Devuelve el total de ventas realizadas
            router.post('/get-user-relative', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT COUNT(
                                            CASE WHEN o.status = 0 OR o.status = 1 THEN 1 END) AS total, 
                                        COUNT(
                                            CASE WHEN o.status = 1 THEN 1 END) AS open 
                                FROM orders AS o 
                                WHERE o.id_enterprise = ? AND o.date > ? ${seller_filter};`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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


        //Dashboard
            // Devuelve el total de pedidos finalizados
            router.post('/get-data-success-order', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT COUNT(*) AS response 
                                FROM orders AS o 
                                    WHERE o.id_enterprise = ? AND o.date > ? AND status = 0 ${seller_filter}`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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

            // Devuelve el total de productos pendientes de entrega
            router.post('/get-data-pending-order', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT COUNT(*) AS response 
                                FROM orders AS o 
                                    WHERE o.id_enterprise = ? AND o.date > ? AND status = 1 ${seller_filter}`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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

            // Devuelve la suma del precio total de los productos entregados/vendidos
            router.post('/get-data-total-sale', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT SUM(amount) AS response
                                FROM (
                                    SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].price'))) AS DECIMAL(10, 2)) AS amount
                                    FROM orders AS o
                                    JOIN (
                                        SELECT 0 AS i 
                                        UNION ALL SELECT 1 
                                        UNION ALL SELECT 2 
                                        UNION ALL SELECT 3 
                                        UNION ALL SELECT 4 
                                        UNION ALL SELECT 5 
                                        UNION ALL SELECT 6 
                                        UNION ALL SELECT 7 
                                        UNION ALL SELECT 8 
                                        UNION ALL SELECT 9
                                    ) AS idx 
                                    ON JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) IS NOT NULL
                                    WHERE o.id_enterprise = ? AND o.date > ? ${seller_filter}
                                    AND JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) = '1'
                                ) AS subquery;`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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

            // Devuelve la información de las ventas totales por período seleccionado
            router.post('/get-data-sale-balance', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, range, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT 
                                    CASE 
                                        WHEN ? = 'day' THEN DATE_FORMAT(date, '%Y-%d-%m')
                                        WHEN ? = 'week' THEN CONCAT(YEAR(date), '-W', WEEK(date, 1))
                                        WHEN ? = 'month' THEN DATE_FORMAT(date, '%m')
                                    END AS period,
                                    SUM(amount) AS response
                                FROM (
                                    SELECT 
                                        date,
                                        CAST(JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].price'))) AS DECIMAL(10, 2)) AS amount
                                    FROM orders
                                    JOIN (
                                        SELECT 0 AS i 
                                        UNION ALL SELECT 1 
                                        UNION ALL SELECT 2 
                                        UNION ALL SELECT 3 
                                        UNION ALL SELECT 4 
                                        UNION ALL SELECT 5 
                                        UNION ALL SELECT 6 
                                        UNION ALL SELECT 7 
                                        UNION ALL SELECT 8 
                                        UNION ALL SELECT 9
                                    ) AS idx 
                                    ON JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) IS NOT NULL
                                    WHERE id_enterprise = ? ${seller_filter} 
                                    AND date > CASE 
                                                    WHEN ? = 'day' THEN DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                                                    WHEN ? = 'week' THEN DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
                                                    WHEN ? = 'month' THEN DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                                                END
                                    AND JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) = '1'
                                ) AS subquery
                                GROUP BY period
                                ORDER BY period;`;
                    connection.con.query(sql, [range, range, range, id_enterprise, range, range, range], (err, result, fields) => {
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

            // Devuelve la información de las ventas totales por período seleccionado
            router.post('/get-data-best-product', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, range} = req.body;
                    const sql = `SELECT 
                                    name,
                                    sku,
                                    SUM(amount) AS total_amount
                                FROM (
                                    SELECT 
                                        CAST(JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].price'))) AS DECIMAL(10, 2)) AS amount,
                                        JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].name'))) AS name,
                                        JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].sku'))) AS sku
                                    FROM orders
                                    JOIN (
                                        SELECT 0 AS i 
                                        UNION ALL SELECT 1 
                                        UNION ALL SELECT 2 
                                        UNION ALL SELECT 3 
                                        UNION ALL SELECT 4 
                                        UNION ALL SELECT 5 
                                        UNION ALL SELECT 6 
                                        UNION ALL SELECT 7 
                                        UNION ALL SELECT 8 
                                        UNION ALL SELECT 9
                                    ) AS idx 
                                    ON JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) IS NOT NULL
                                    WHERE id_enterprise = ?
                                    AND JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) = '1'
                                    AND date > CASE 
                                                WHEN ? = '1M' THEN DATE_SUB(CURDATE(), INTERVAL 1 MONTH)
                                                WHEN ? = '6M' THEN DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
                                                WHEN ? = '12M' THEN DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                                            END
                                ) AS subquery
                                GROUP BY name, sku
                                ORDER BY total_amount DESC
                                LIMIT 5;
                                `;
                    connection.con.query(sql, [id_enterprise, range, range, range], (err, result, fields) => {
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


        //Remitos/Pedidos
            // Devuelve la cantidad de productos entregados, sin entregar, cancelados, devueltos
            router.post('/get-orders-data-products', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT status_value, COUNT(*) AS count_status
                                FROM ( SELECT JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) AS status_value 
                                    FROM orders AS o
                                    JOIN ( 
                                        SELECT 0 AS i 
                                        UNION ALL SELECT 1 
                                        UNION ALL SELECT 2 
                                        UNION ALL SELECT 3 
                                        UNION ALL SELECT 4 
                                        UNION ALL SELECT 5 
                                        UNION ALL SELECT 6 
                                        UNION ALL SELECT 7 
                                        UNION ALL SELECT 8 
                                        UNION ALL SELECT 9 
                                    ) AS idx 
                                    ON JSON_UNQUOTE(JSON_EXTRACT(detail, CONCAT('$[', idx.i, '].status'))) IS NOT NULL
                                    WHERE o.id_enterprise = ? AND o.date > ? ${seller_filter} 
                                ) AS subquery 
                                GROUP BY status_value 
                                ORDER BY status_value;`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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

            //Devuelve la cantidad de pedidos finalizados y pendientes
            router.post('/get-orders-data-orders', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit, seller} = req.body;
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT 
                                    COUNT(CASE WHEN status = 1 THEN 1 END) AS open_orders,
                                    COUNT(CASE WHEN status = 0 THEN 1 END) AS close_orders
                                FROM 
                                    orders AS o
                                WHERE 
                                    o.id_enterprise = ? 
                                    AND o.date > ? 
                                    ${seller_filter};`;
                    connection.con.query(sql, [id_enterprise, date_limit], (err, result, fields) => {
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
            router.post('/get-count-orders', auth.verifyToken, async function(req, res, next){
                try{
                    //seller = null => significa q el admin llama y el puede filtrar por sellerF
                    //seller != null => significa que cualquier user llama y no puede filtrar
                    let {id_enterprise, dateTime, sellerF, state, seller} = req.body;
                    let dateTime_var = (dateTime)?`AND date = "${dateTime}"`:'';
                    let sellerF_var = (sellerF)?`AND seller = ${sellerF}`:'';
                    let state_var = (state != undefined)?`AND status = ${state}`:'';
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT COUNT(*) as total 
                                FROM orders
                                WHERE id_enterprise = ? 
                                ${dateTime_var} ${sellerF_var} ${state_var} ${seller_filter}`;
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
                    let {id_enterprise, dateTime, sellerF, state, page, size, seller} = req.body;
                    let dateTime_var = (dateTime)?`AND o.date = "${dateTime}"`:'';
                    let sellerF_var = (sellerF)?`AND o.seller = ${sellerF}`:'';
                    let state_var = (state != undefined)?`AND o.status = ${state}`:'';
                    let seller_filter = (seller)?`AND seller = ${seller}`:'';
                    const sql = `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.thumbnail AS customer_thumbnail, e.name AS employee_name
                                FROM orders AS o 
                                INNER JOIN customer AS c ON o.customer = c.id
                                INNER JOIN employee AS e ON o.seller = e.id 
                                WHERE o.id_enterprise = ?
                                ${dateTime_var} ${sellerF_var} ${state_var} ${seller_filter}`;
                    connection.con.query(sql, [id_enterprise, size*page], (err, result, fields) => {
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
                                e.name AS e_name, e.thumbnail AS e_thumbnail, e.email AS e_email, e.address AS e_address, e.phone_1 as e_phone, e.cuit as e_cuit, e.city as e_city, e.state as e_state, e.country as e_country, e.cp as e_cp,
                                c.name as c_name, c.email as c_email, c.phone as c_phone, c.mobile as c_mobile, c.address as c_address, c.city as c_city, c.state as c_state, c.country as c_country,
                                em.name AS em_name, em.email AS em_email
                                FROM orders AS o 
                                INNER JOIN enterprise AS e ON o.id_enterprise = e.id 
                                INNER JOIN customer AS c ON o.customer = c.id
                                INNER JOIN employee AS em ON o.seller = em.id 
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
                    const sql = `SELECT p.*
                                FROM product AS p
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

            //Crea un remito nuevo y actualiza el stock de los productos
            router.post('/create-order-detail', auth.verifyToken, async function(req, res, next) {
                const { form: { id_enterprise, customer, detail, shipment, observation, seller }, edit: editRegister } = req.body;
            
                async function createOrderAndProducts(conect, id_enterprise, customer, detail, shipment, observation, seller, editRegister) {
                    try {
                        // Start the transaction
                        await new Promise((resolve, reject) => {
                            conect.beginTransaction(err => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
            
                        // Step 1: Get the last nroRemito
                        const [lastRemitoResult] = await new Promise((resolve, reject) => {
                            const getNro = `SELECT nroRemito 
                                            FROM orders
                                            WHERE id_enterprise = ? 
                                            ORDER BY id 
                                            DESC LIMIT 1;`;
                            conect.query(getNro, id_enterprise, (err, results) => {
                                if (err) return reject(err);
                                resolve(results);
                            });
                        });
            
                        const nro = generateNumber(lastRemitoResult?.nroRemito || '');
            
                        // Step 2: Insert the new order
                        const orderValues = [
                            id_enterprise,
                            nro,
                            customer,
                            detail,
                            shipment,
                            observation,
                            seller
                        ];
            
                        const insertResult = await new Promise((resolve, reject) => {
                            const orderQuery = `INSERT INTO orders
                                                (id_enterprise, nroRemito, date, customer, detail, shipment, observation, seller, status) 
                                                VALUES (?,?, CURDATE(), ?, ?, ?, ?, ?, 1)`;
                            conect.query(orderQuery, orderValues, (err, results) => {
                                if (err) return reject(err);
                                resolve(results);
                            });
                        });
            
                        const insertedOrderId = insertResult.insertId;
            
                        // Step 3: Update product stock if necessary
                        if (editRegister && editRegister.length > 0) {
                            await Promise.all(editRegister.map(product => {
                                return new Promise((resolve, reject) => {
                                    const productQuery = `UPDATE product SET stock_available = (stock_available - ?) WHERE id = ?`;
                                    conect.query(productQuery, [product.editQty, product.id_product], (err, results) => {
                                        if (err) return reject(err);
                                        resolve(results);
                                    });
                                });
                            }));
                        }
            
                        // Commit the transaction
                        await new Promise((resolve, reject) => {
                            conect.commit(err => {
                                if (err) return reject(err);
                                resolve();
                            });
                        });
            
                        return { orderId: insertedOrderId };
                    } catch (error) {
                        // Rollback the transaction in case of any error
                        await new Promise((resolve, reject) => {
                            conect.rollback(() => {
                                reject(error);
                            });
                        });
                    }
                }
            
                connection.con.getConnection(async (err, conect) => {
                    if (err) {
                        res.send({ status: 0, error: err });
                        return;
                    }
            
                    try {
                        const response = await createOrderAndProducts(conect, id_enterprise, customer, detail, shipment, observation, seller, editRegister);
                        res.send({ status: 1, data: response });
                    } catch (error) {
                        res.send({ status: 0, error: error.message });
                    } finally {
                        conect.release();
                    }
                });
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

            //Actualiza el estado del remito y lo cierra si se cumplen ciertas condiciones(no hay productos "no entregados")
            router.post('/update-order-state', auth.verifyToken, async function(req, res, next) {
                const { form: { id, detail }, edit: editRegister, close_order: close_order } = req.body;
              
                async function updateOrdersAndProductsAndStatus(conect, id, detail, editRegister, close_order) {
                    return new Promise((resolve, reject) => {
                        // Consulta de actualización para la tabla "orders"
                        let orderUpdates = [];
                            (detail != '')?orderUpdates.push('detail = ?'):'';
                            orderUpdates.push('status = ?');
                        
                        let orderValues = [];
                            (detail != '')?orderValues.push(detail):'';
                            (close_order)?orderValues.push(0):orderValues.push(1);
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
                                    let query;
                                    if(product.type == 'real') {
                                        query = `UPDATE product SET stock_real = (stock_real - ?), sale_date = NOW() WHERE id = ?`;
                                    } else {
                                        query = `UPDATE product SET stock_available = (stock_available - ?) WHERE id = ?`;
                                    }
                                    conect.query(query, [product.editQty, product.id_product], (err, results) => {
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
              
                  updateOrdersAndProductsAndStatus(conect, id, detail, editRegister, close_order)
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

            //Abre el remito que está cerrado, solo hace eso
            router.post('/update-order-open-state', auth.verifyToken, async function(req, res, next) {
                try {
                    let { id, status } = req.body;

                    const sql = `UPDATE orders SET status = ? WHERE id = ?`;
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

        
        // Clientes
            // Devuelve el número total de clientes por empresa para paginador
            router.post('/get-count-customers', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT COUNT(*) as total FROM customer WHERE id_enterprise = ?`;
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

            // Devuelve el listado de clientes
            router.post('/get-customers', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT * FROM customer WHERE id_enterprise = ?`;
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
                                //éxito en no encontrar ese cliente
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

            //Edita un cliente, pero los campos de información básica
            router.post('/edit-customer-information', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, name, cuit, email, phone, mobile, address, city, state, country} = req.body;

                    const sql = `UPDATE customer 
                                SET name=?, cuit=?, email=?, phone=?, mobile=?, address=?, city=?, state=?, country=? 
                                WHERE id = ?`;
                    connection.con.query(sql, [name, cuit, email, phone, mobile, address, city, state, country, id ], (err, result, field) => {
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

            //Activa o desactiva un cliente
            router.post('/edit-customer-activation', auth.verifyToken, async function(req, res, next){
                try {
                    let {id, status} = req.body;

                    const sql = `UPDATE customer 
                                SET status=? WHERE id = ?`;
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

            // Edita una imagen para un cliente por ID
            router.post('/edit-customer-image', auth.verifyToken, async (req, res, next) => {
                try {
                    let {id, id_enterprise, thumbnail, prev_thumb} = req.body;
                    let changedRows;

                    if(thumbnail.includes(';base64,')){
                        await save_image(id_enterprise, id, 'customer', 'thumbnail', thumbnail, 600, 600, prev_thumb)
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
                        const sql = `UPDATE customer SET thumbnail = ? WHERE id = ?`;
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


        // Productos
            // Devuelve datos específicos de la tabla productos
            router.post('/get-products-data', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise, date_limit} = req.body;
                    const sql = `SELECT 
                                    CAST(COUNT(p.id) AS CHAR) AS stock,
                                    FORMAT(SUM(CASE WHEN p.stock_real > 0 THEN p.sale_price * p.stock_real ELSE 0 END), 2) AS stock_price,
                                    CAST(COUNT(CASE WHEN p.sale_date IS NOT NULL AND p.sale_date <> '' AND p.sale_date > ? AND p.stock_real = 0 THEN 1 ELSE NULL END) AS CHAR) AS nostock,
                                    FORMAT(SUM(CASE WHEN p.purchase_date IS NOT NULL AND p.purchase_date <> '' AND p.purchase_date < ? THEN p.sale_price ELSE 0 END), 2) AS nostock_price
                                FROM product AS p 
                                    WHERE p.stock_real > 0 AND p.id_enterprise = ?;`;
                    connection.con.query(sql, [date_limit, date_limit, id_enterprise], (err, result, fields) => {
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

            //Devuelve el valor del stock completo
            router.post('/get-total-stock', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_enterprise} = req.body;
                    const sql = `SELECT FORMAT(SUM(p.sale_price * p.stock_real), 2) AS response 
                                FROM product AS p 
                                WHERE p.stock_real > 0 AND p.id_enterprise = ?;`;
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

            // Devuelve el número total de productos por id_enterprise para paginador
            router.post('/get-count-products', auth.verifyToken, async function(req, res, next){
                try{
                    //debo sumarle los filtros
                    //search -> name
                    //category -> category
                    //stock -> stock_real > 0
                    //state -> state = 1
                    //filters -> filters, busca si el numero pasado o varios numeros estan incluídos
                    let {id_enterprise, search, category, is_stock, state, filters} = req.body;
                    let search_var = (search)?`AND name LIKE "%${search}%"`:'';
                    let category_var = (category)?`AND category = ${category}`:'';
                    let is_stock_var = (is_stock)?((is_stock == 'Con stock')?'AND stock_real > 0':'AND stock_real = 0'):'';
                    let state_var = (state)?`AND state = "${state}"`:'';
                    let filters_var = '';
                    if(filters) {
                        let arr = filters.split(',');
                        for (let index = 0; index < arr.length; index++) {
                            filters_var += `AND FIND_IN_SET(${arr[index]}, filters) > 0 `
                        }
                    }
                    const sql = `SELECT COUNT(*) as total 
                                FROM product 
                                WHERE id_enterprise = ? 
                                ${search_var} ${category_var} ${is_stock_var} ${state_var} ${filters_var}`;
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
                    let {id_enterprise, search, category, is_stock, state, filters, page, size} = req.body;
                    let search_var = (search)?`AND p.name LIKE "%${search}%"`:'';
                    let category_var = (category)?`AND p.category = ${category}`:'';
                    let is_stock_var = (is_stock)?((is_stock == 'Con stock')?'AND stock_real > 0':'AND stock_real = 0'):'';
                    let state_var = (state)?`AND p.state = "${state}"`:'';
                    let filters_var = '';
                    if(filters) {
                        let arr = filters.split(',');
                        for (let index = 0; index < arr.length; index++) {
                            filters_var += `AND FIND_IN_SET(${arr[index]}, filters) > 0 `
                        }
                    }
                    const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color 
                                FROM product AS p INNER JOIN categories AS c ON p.category = c.id 
                                WHERE p.id_enterprise = ?
                                ${search_var} ${category_var} ${is_stock_var} ${state_var} ${filters_var}`;
                    connection.con.query(sql, [id_enterprise, size*page], (err, result, fields) => {
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

            // Devuelve un producto por id_product(devuelve los filtros como un array de nombres)
            router.post('/get-product-detail', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_product} = req.body;
                    const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color, s.name AS storage_name, prov.name AS provider_name, 
                                GROUP_CONCAT(f.filter_value) AS filter_values 
                                FROM product AS p 
                                INNER JOIN categories AS c ON p.category = c.id 
                                INNER JOIN storage AS s ON p.storage_location = s.id 
                                INNER JOIN provider AS prov ON p.provider = prov.id 
                                LEFT JOIN filters AS f ON FIND_IN_SET(f.id, p.filters) > 0 
                                WHERE p.id = ? 
                                GROUP BY p.id, c.name, c.color_badge, s.name, prov.name;`;
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

            // Devuelve un producto por ID solamente(devuelve los filtros como una cadena de string)
            router.post('/get-product-detail-by-id', auth.verifyToken, async function(req, res, next){
                try{
                    let {id_product} = req.body;
                    const sql = `SELECT p.*, c.name AS category_item, c.color_badge AS category_color, s.name AS storage_name, prov.name AS provider_name
                                FROM product AS p INNER JOIN categories AS c ON p.category = c.id
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


            //Editar campos de un producto
                //Crea un producto nuevo pero solo la parte de información básica de producto
                router.post('/create-product', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id_enterprise, name, description, category, sku } = req.body;

                        const sql = `INSERT INTO product(
                                        id_enterprise,
                                        image,
                                        name,
                                        description,
                                        category,
                                        sku,
                                        stock_real,
                                        stock_available,
                                        storage_location,
                                        provider,
                                        purchase_date,
                                        sale_date,
                                        state) 
                                    VALUES (
                                        ?,
                                        'no-image.png',
                                        ?,
                                        ?,
                                        ?,
                                        ?,
                                        0,
                                        0,
                                        1,
                                        1,
                                        '',
                                        '',
                                        'inactivo')`;
                        connection.con.query(sql, [id_enterprise, name, description, category, sku], (err, result, field) => {
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
                        let {name, description, category, sku, id, id_enterprise} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET name=?,description=?,category=?,sku=? WHERE p.id = ?`;
                        connection.con.query(sql, [name, description, category, sku, id], (err, result, field) => {
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
                        let {id, id_enterprise, image, prev_thumb} = req.body;
                        let changedRows;

                        if(image.includes(';base64,')){
                            await save_image(id_enterprise, id, 'product', 'picture', image, 600, 600, prev_thumb)
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
                                    SET provider=?, purchase_date=?, sale_price=?, purchase_price=? WHERE p.id = ?`;
                        connection.con.query(sql, [provider, purchase_date, purchase_price, purchase_price, id], (err, result, field) => {
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

                //Edita un producto, pero los campos de stock_real, stock_available
                router.post('/edit-product-stock', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, stock_real} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET stock_real=?, stock_available=?, purchase_date=NOW() WHERE p.id = ?`;
                        connection.con.query(sql, [stock_real, stock_real, id], (err, result, field) => {
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

                //Edita un producto, pero solo el campo filters para filtros adicionales
                router.post('/edit-product-filters', auth.verifyToken, async function(req, res, next){
                    try {
                        let {id, filters} = req.body;

                        const sql = `UPDATE product AS p 
                                    SET filters=? WHERE p.id = ?`;
                        connection.con.query(sql, [filters.join(','), id], (err, result, field) => {
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
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.stock_real > 0 AND p.storage_location = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT FORMAT(SUM(p.sale_price), 2) FROM product as p WHERE p.stock_real > 0 AND p.storage_location = ? AND p.id_enterprise = ? ) 
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
                                                VALUES (?,?,?,?,?,?,?, 1);`;
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
            // Devuelve el número total de provedores por empresa para el paginador
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
                                SELECT CAST(COUNT(p.id) AS CHAR) as data FROM product as p WHERE p.stock_real > 0 AND p.provider = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT FORMAT(SUM(p.purchase_price), 2) FROM product as p WHERE p.stock_real > 0 AND p.provider = ? AND p.id_enterprise = ? 
                                UNION 
                                SELECT MAX(STR_TO_DATE(purchase_date, '%Y-%m-%d')) FROM product AS p WHERE p.stock_real > 0 AND p.provider = ? AND p.id_enterprise = ?
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
                const sql = `SELECT u.id AS id_user, id_enterprise, u.email, u.thumbnail, u.state AS verified_state,
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

        //Devuelve un listado de los roles
        router.post('/get-roles', auth.verifyToken, async function(req, res, next){
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

        //Actualiza el rol de un usuario
        router.post('/update-user-role', auth.verifyToken, async function(req, res, next){
            try {
                let {id, role} = req.body;
                const _sql = `UPDATE employee SET role=? WHERE id_user = ?`;
                connection.con.query(_sql, [role, id], (err, result, fields) => {
                    if (err) res.send({status: 0, data: err});
                    res.send({status: 1, data: result});
                });
            } catch (error) {
                res.send({status: 0, error: error});
            }
            connection.con.end;
        });

    // -----------------------------------

module.exports = router;