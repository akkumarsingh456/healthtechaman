import React, { useState } from 'react';

const ContactOwnerForm = () => {
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
                timeout: 5000 // 5 seconds timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('Submission successful:', result);
            // Handle successful submission (e.g., reset form, show a success message)
        } catch (err) {
            if (err.name === 'AbortError') {
                console.error('Request timed out', err);
                setError('Request timed out, please try again!');
            } else {
                console.error('Submission error:', err);
                setError('Submission failed. Please check the console for details.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <input type="text" name="name" onChange={handleChange} value={formData.name} placeholder="Name" required />
            <input type="email" name="email" onChange={handleChange} value={formData.email} placeholder="Email" required />
            <textarea name="message" onChange={handleChange} value={formData.message} placeholder="Message" required></textarea>
            <button type="submit" disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</button>
            {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
    );
};

export default ContactOwnerForm;