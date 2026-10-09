import fs from 'node:fs';
import { escapeHtml } from '../src/transactional-email.mjs';
const templates = [
 ['confirmation','Confirma tu cuenta de ERMIF','Confirma tu correo','Gracias por registrarte en ERMIF. Confirma tu dirección para continuar.','Confirmar mi correo'],
 ['invite','Invitación a ERMIF','Te invitamos a ERMIF','Recibiste una invitación para crear tu acceso. Si la esperabas, continúa con el siguiente enlace.','Aceptar invitación'],
 ['magic_link','Tu enlace de acceso a ERMIF','Accede a tu cuenta','Solicitaste un enlace para iniciar sesión en ERMIF.','Entrar a ERMIF'],
 ['email_change','Confirma tu nuevo correo en ERMIF','Confirma el cambio de correo','Recibimos una solicitud para cambiar la dirección de correo asociada a tu cuenta.','Confirmar cambio'],
 ['recovery','Restablece tu contraseña de ERMIF','Recupera tu acceso a ERMIF','Recibimos una solicitud para restablecer la contraseña de tu cuenta en ERMIF.','Crear una nueva contraseña'],
 ['reauthentication','Tu código de verificación de ERMIF','Verifica tu identidad','Usa el siguiente código para confirmar la operación que solicitaste.',null],
 ['password_changed_notification','Tu contraseña de ERMIF ha cambiado','Contraseña actualizada','Se cambió la contraseña de tu cuenta de ERMIF.'],
 ['email_changed_notification','Tu correo de ERMIF ha cambiado','Correo actualizado','Se cambió la dirección de correo asociada a tu cuenta de ERMIF.'],
 ['phone_changed_notification','Tu teléfono de ERMIF ha cambiado','Teléfono actualizado','Se cambió el teléfono asociado a tu cuenta de ERMIF.'],
 ['identity_linked_notification','Nuevo método de acceso en ERMIF','Método de acceso añadido','Se vinculó un método de inicio de sesión a tu cuenta de ERMIF.'],
 ['identity_unlinked_notification','Método de acceso retirado de ERMIF','Método de acceso retirado','Se desvinculó un método de inicio de sesión de tu cuenta de ERMIF.'],
 ['mfa_factor_enrolled_notification','Verificación de seguridad añadida en ERMIF','Verificación añadida','Se añadió un método de verificación de seguridad a tu cuenta de ERMIF.'],
 ['mfa_factor_unenrolled_notification','Verificación de seguridad retirada de ERMIF','Verificación retirada','Se retiró un método de verificación de seguridad de tu cuenta de ERMIF.'],
];
fs.mkdirSync('emails/auth',{recursive:true});
const manifest=[];
for (const [key,subject,title,body,action] of templates) {
 const security=key.endsWith('_notification');
 const content=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:Arial,sans-serif;color:#182b36;line-height:1.6"><main style="max-width:580px;margin:auto;padding:24px"><p style="color:#087f5b;font-weight:bold;font-size:22px">ERMIF</p><h1 style="font-size:23px">${escapeHtml(title)}</h1><p>Hola:</p><p>${escapeHtml(body)}</p>
${action ? `<p><a href="{{ .ConfirmationURL }}" style="color:#087f5b">${escapeHtml(action)}</a></p>` : key==='reauthentication' ? '<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>' : ''}
<p>${security ? 'Si no reconoces este cambio, entra directamente a ermif.com, recupera tu acceso y contacta con nuestro equipo.' : 'Si no solicitaste esta operación, puedes ignorar este mensaje.'}</p>
<p>Por tu seguridad, no compartas enlaces de acceso, códigos ni contraseñas.</p><p>Equipo de ERMIF<br><a href="mailto:mlvn696986@gmail.com">mlvn696986@gmail.com</a><br><a href="https://ermif.com">ermif.com</a></p></main></body></html>`;
 fs.writeFileSync(`emails/auth/${key}.html`,content+'\n');
 manifest.push({key,subject,file:`${key}.html`,requiresSecurityNotificationToggle:security});
}
fs.writeFileSync('emails/auth/manifest.json',JSON.stringify(manifest,null,2)+'\n');

const config = ['project_id = "ermif-mail-templates"', ''];
for (const entry of manifest) {
 const notification = entry.requiresSecurityNotificationToggle;
 const key = notification ? entry.key.replace(/_notification$/, '') : entry.key;
 config.push('[auth.email.' + (notification ? 'notification' : 'template') + '.' + key + ']');
 if (notification) config.push('enabled = true');
 config.push('subject = ' + JSON.stringify(entry.subject), 'content_path = ' + JSON.stringify(entry.file), '');
}
fs.mkdirSync('emails/auth/supabase', { recursive: true });
fs.writeFileSync('emails/auth/supabase/config.toml', config.join('\n'));

console.log('13 plantillas locales preparadas. No se modificó Supabase ni se enviaron correos.');
