// Función que realiza la duplicación de aniversarios vencidos

const connection = require('../settings/connection');
const generateNumber = require('../functions/generateNumber');

// Función para generar un eventId único
const generateUniqueEventId = async () => {
    let newId;
    let exists = true;
    while (exists) {
        newId = generateNumber(20); // Genera código alfanumérico de 20 caracteres
        exists = await checkIfEventIdExists(newId);
    }
    return newId;
};

// Función para verificar si el eventId existe en la base de datos
const checkIfEventIdExists = (newId) => {
    return new Promise((resolve, reject) => {
        const checkEventIdQuery = `SELECT eventId FROM event WHERE eventId = ?`;
        connection.con.query(checkEventIdQuery, [newId], (err, result) => {
            if (err) {
                return reject(err);
            }
            resolve(result.length > 0); // Si existe un duplicado, devuelve true
        });
    });
};

async function duplicateExpiredAnniversaries() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Ignora el tiempo para comparar solo la fecha

        // 1. Obtener eventos de tipo "aniversario" con status = 1 y finalized < hoy
        const query = `SELECT * FROM event WHERE type = 'aniversario' AND status = 1 AND finalized < ?`;
        connection.con.query(query, [today], async (err, results) => {
            if (err) {
                console.error("Error al obtener eventos:", err);
                return;
            }

            if (results.length === 0) {
                console.log('No hay eventos vencidos para duplicar.');
                return;
            }

            // 2. Duplicar cada evento vencido con finalized actualizado
            const duplicatedEvents = await Promise.all(results.map(async event => {
                const newEventId = await generateUniqueEventId();

                // Crear la nueva fecha `finalized` sumando un año
                const newFinalizedDate = new Date(event.finalized);
                newFinalizedDate.setFullYear(newFinalizedDate.getFullYear() + 1);
                const formattedFinalizedDate = newFinalizedDate.toISOString().split('T')[0];

                return [
                    newEventId,
                    event.profileId,
                    event.type,
                    event.name,
                    event.date,
                    event.description,
                    event.goal,
                    today,                  // Fecha de creación
                    formattedFinalizedDate, // Nueva fecha de finalized en formato 'YYYY-MM-DD'
                    1                       // Nuevo status activo
                ];
            }));

            // 3. Insertar eventos duplicados
            const insertQuery = `INSERT INTO event (eventId, profileId, type, name, date, description, goal, created, finalized, status) VALUES ?`;
            connection.con.query(insertQuery, [duplicatedEvents], (insertErr, insertResult) => {
                if (insertErr) {
                    console.error("Error al insertar eventos duplicados:", insertErr);
                    return;
                }

                // 4. Actualizar el `status` de los eventos originales a 0
                const updateQuery = `UPDATE event SET status = 0 WHERE id IN (?)`;
                const expiredEventIds = results.map(event => event.id);
                connection.con.query(updateQuery, [expiredEventIds], (updateErr, updateResult) => {
                    if (updateErr) {
                        console.error("Error al actualizar eventos originales:", updateErr);
                        return;
                    }

                    console.log(`${insertResult.affectedRows} eventos duplicados y ${updateResult.affectedRows} eventos actualizados a status 0.`);
                });
            });
        });
    } catch (error) {
        console.error("Error en la tarea de duplicación de aniversarios:", error);
    }
}

module.exports = duplicateExpiredAnniversaries;