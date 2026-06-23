import { useEffect } from 'react';

export default function GoogleCalendarCallback() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (window.opener) {
            window.opener.postMessage(
                { type: 'google-calendar-code', code, error },
                window.location.origin
            );
            window.close();
        }
    }, []);

    return (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Conectando con Google Calendar…
        </div>
    );
}
