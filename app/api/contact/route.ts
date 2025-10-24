import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();

    // Basic validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Send email to Worldwide FM team
    const result = await resend.emails.send({
      from: `${process.env.NEXT_PUBLIC_APP_NAME || 'Worldwide FM'} Contact Form <${process.env.SUPPORT_EMAIL || 'noreply@worldwidefm.net'}>`,
      to: 'info@worldwidefm.net',
      subject: `Contact Form: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p><em>This message was sent from the Worldwide FM contact form.</em></p>
      `,
      replyTo: email,
    });

    // Send confirmation email to the user
    await resend.emails.send({
      from: `${process.env.NEXT_PUBLIC_APP_NAME || 'Worldwide FM'} <${process.env.SUPPORT_EMAIL || 'noreply@worldwidefm.net'}>`,
      to: email,
      subject: 'Thank you for contacting Worldwide FM',
      html: `
        <h2>Thank you for reaching out!</h2>
        <p>Dear ${name},</p>
        <p>We've received your message and will get back to you as soon as possible.</p>
        <p><strong>Your message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p>Best regards,<br>The Worldwide FM Team</p>
      `,
    });

    console.log('Contact form email sent successfully:', result);

    return NextResponse.json(
      { success: true, message: 'Message sent successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error sending contact form email:', error);

    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}
