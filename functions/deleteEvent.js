// Función que realiza la duplicación de aniversarios vencidos

const connection = require('../settings/connection');

async function deleteExpiredEvents() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Ignora el tiempo para comparar solo la fecha

        // 1. Obtener eventos de tipo "deseo" con status = 1 y finalized < hoy
        const query = `SELECT * FROM event WHERE type = 'deseo' AND status = 1 AND finalized < ?`;
        connection.con.query(query, [today], async (err, results) => {
            if (err) {
                console.error("Error al obtener eventos:", err);
                return;
            }

            if (results.length === 0) {
                console.log('No hay eventos vencidos para eliminar.');
                return;
            }

            // 2. Actualizar el `status` de los eventos originales a 0
            const updateQuery = `UPDATE event SET status = 0 WHERE id IN (?)`;
            const expiredEventIds = results.map(event => event.id);
            connection.con.query(updateQuery, [expiredEventIds], (updateErr, updateResult) => {
                if (updateErr) {
                    console.error("Error al actualizar eventos originales:", updateErr);
                    return;
                }

                console.log(`${updateResult.affectedRows} eventos actualizados a status 0.`);
            });
        });
    } catch (error) {
        console.error("Error en la tarea de eliminación de eventos:", error);
    }
}

module.exports = deleteExpiredEvents;