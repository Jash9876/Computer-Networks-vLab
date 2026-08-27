// Public Certificate Verification Endpoint (GET /api/certificate/verify?code=CNVL-...)
const { query } = require('../db');

module.exports = async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const certCode = req.query.code;
        if (!certCode) {
            return res.status(400).json({ error: 'Certificate code (?code=...) is required.' });
        }

        const certRes = await query(
            `SELECT 
                c.certificate_code,
                c.final_score,
                c.issued_at,
                u.full_name as student_name,
                u.register_number,
                u.department,
                e.id as experiment_id,
                e.title as experiment_title
             FROM certificates c
             JOIN users u ON c.student_id = u.id
             JOIN experiments e ON c.experiment_id = e.id
             WHERE c.certificate_code = $1`,
            [certCode.trim()]
        );

        if (certRes.rows.length === 0) {
            return res.status(404).json({
                valid: false,
                message: 'Invalid certificate code. No matching record exists in the SRMIST Virtual Laboratory registry.'
            });
        }

        const record = certRes.rows[0];

        return res.status(200).json({
            valid: true,
            certificate: {
                code: record.certificate_code,
                studentName: record.student_name,
                registerNumber: record.register_number,
                department: record.department,
                experimentId: record.experiment_id,
                experimentTitle: record.experiment_title,
                score: record.final_score,
                issuedDate: record.issued_at,
                institution: 'SRM Institute of Science and Technology'
            }
        });
    } catch (error) {
        console.error('Certificate verification error:', error);
        return res.status(500).json({ error: 'Failed to verify certificate.' });
    }
};
