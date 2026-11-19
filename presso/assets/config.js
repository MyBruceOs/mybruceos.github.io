/* Connexion à la base Supabase de Presso Center.
   Vide = mode démo : tout reste dans le navigateur, rien n'est partagé.
   La clé « publishable » est publique par conception : la sécurité repose
   sur les règles RLS de la base (voir supabase/schema.sql). */
window.PRESSO_CONFIG = {
  supabaseUrl: 'https://pbiyyuemvcoexzbkavab.supabase.co',
  supabaseKey: 'sb_publishable_3xngeqisgMYAtPDFCyv9gw_8ERnJn1r'
};
