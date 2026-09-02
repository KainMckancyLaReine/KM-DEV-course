/* ==========================================================================
   KM.dev Academy — Dutch
   --------------------------------------------------------------------------
   The marketing pages carry their translations in the markup (data-en /
   data-nl). The academy cannot: its interface is assembled in JavaScript, and
   scattering attribute pairs through eight thousand lines of rendering code
   would be a worse thing to maintain than one dictionary.

   So this file does the same job one step later. Every phrase the interface
   can produce is listed below with its Dutch equivalent, and a small engine
   swaps them in the rendered document — text nodes and the four attributes a
   reader can actually perceive. Originals are kept, so switching back to
   English restores the document rather than reloading it.

   Course content is not translated here. Lessons, questions, prompts and
   briefs carry their own Dutch columns in the database and arrive already in
   the right language (see km-data.js). This file only covers the interface
   around them, which is why no sentence below is longer than a paragraph.

   Adding a phrase: run `node build/i18n-scan.js`. It walks every page in both
   roles and reports any rendered phrase that is missing from this dictionary.
   ========================================================================== */

window.KMT = (function () {
  'use strict';

  var DICT = {
    /* ------------------------------------------------------------- states */
    'Error': 'Fout',
    'Something went wrong.': 'Er ging iets mis.',
    'Try again': 'Opnieuw proberen',
    'Not found': 'Niet gevonden',
    'Not available': 'Niet beschikbaar',
    'Not yet.': 'Nog niet.',
    'Not yet': 'Nog niet',
    'Not quite': 'Net niet',
    'Not quite yet.': 'Net nog niet.',
    'Loading…': 'Laden…',

    /* --------------------------------------------------------- preview bar */
    'Preview mode': 'Voorbeeldmodus',
    'Preview (this browser)': 'Voorbeeld (deze browser)',
    'this browser': 'deze browser',
    'How to connect it': 'Zo koppel je het',
    'No Supabase project is connected, so accounts and progress live in this browser only.':
      'Er is geen Supabase-project gekoppeld, dus accounts en voortgang staan alleen in deze browser.',
    'Nothing here is a real account.': 'Niets hier is een echt account.',
    'Preview accounts — one click, no password to remember':
      'Voorbeeldaccounts — één klik, geen wachtwoord om te onthouden',

    /* ------------------------------------------------------------ nav/auth */
    'Log in': 'Inloggen',
    'Log out': 'Uitloggen',
    'Start learning': 'Begin met leren',
    'Account': 'Account',
    'Dashboard': 'Dashboard',
    'My Course': 'Mijn cursus',
    'My Progress': 'Mijn voortgang',
    'My progress': 'Mijn voortgang',
    'Progress': 'Voortgang',
    'Prompt library': 'Promptbibliotheek',
    'Admin': 'Beheer',
    'Settings': 'Instellingen',
    'Search': 'Zoeken',
    'Search lessons, prompts, levels…': 'Zoek lessen, prompts, levels…',
    'Signed in.': 'Ingelogd.',
    'Opening your dashboard…': 'Je dashboard wordt geopend…',
    'That does not look like an email address.': 'Dat lijkt geen e-mailadres.',
    'Please enter your name.': 'Vul je naam in.',
    'Please enter your name': 'Vul je naam in',
    'Use at least 8 characters.': 'Gebruik minstens 8 tekens.',
    'The two passwords do not match.': 'De twee wachtwoorden komen niet overeen.',
    'Enter your password.': 'Vul je wachtwoord in.',
    'Creating account…': 'Account aanmaken…',
    'Signing in…': 'Inloggen…',
    'Account created.': 'Account aangemaakt.',
    'Preparing your learning environment…': 'Je leeromgeving wordt klaargezet…',
    'Welcome back.': 'Welkom terug.',
    'If that address has an account, a reset link is on its way.':
      'Als er een account bij dat adres hoort, is er een herstellink onderweg.',

    /* ---------------------------------------------------------- dashboard */
    'Good to see you,': 'Fijn je te zien,',
    'Course overview': 'Cursusoverzicht',
    'Your next step': 'Je volgende stap',
    'All caught up': 'Helemaal bij',
    'Every published lesson is complete.': 'Elke gepubliceerde les is afgerond.',
    'Open the prompt library': 'Open de promptbibliotheek',
    'Course progress': 'Cursusvoortgang',
    'Levels': 'Levels',
    'Level': 'Level',
    'Recently completed': 'Recent afgerond',
    'All progress': 'Alle voortgang',
    'Nothing completed yet. The first lesson takes about ten minutes.':
      'Nog niets afgerond. De eerste les kost ongeveer tien minuten.',
    'Nothing completed yet.': 'Nog niets afgerond.',
    'Saved lessons': 'Opgeslagen lessen',
    'saved': 'opgeslagen',
    'Press': 'Druk op',
    'on any lesson to save it here.': 'bij een les om hem hier op te slaan.',
    'Continue lesson': 'Verder met les',
    'Take the assessment': 'Doe de toets',
    'Levels completed': 'Levels afgerond',
    'Levels complete': 'Levels afgerond',
    'Lessons completed': 'Lessen afgerond',
    'Lessons complete': 'Lessen afgerond',
    'Lessons published': 'Lessen gepubliceerd',
    'Assessment attempts': 'Toetspogingen',
    'lessons completed': 'lessen afgerond',
    'levels completed': 'levels afgerond',
    'Your dashboard': 'Je dashboard',
    'Go to': 'Ga naar',

    /* ------------------------------------------------------------- course */
    'Course': 'Cursus',
    'In writing': 'In ontwikkeling',
    'In progress': 'Bezig',
    'Not started': 'Niet begonnen',
    'not started': 'niet begonnen',
    'not passed': 'niet gehaald',
    'levels ·': 'levels ·',
    'lessons ·': 'lessen ·',
    'projects ·': 'projecten ·',
    'assessments ·': 'toetsen ·',
    'questions ·': 'vragen ·',
    'published ·': 'gepubliceerd ·',
    'published so far': 'tot nu toe gepubliceerd',
    'published': 'gepubliceerd',
    'planned': 'gepland',
    'total': 'totaal',
    'started': 'begonnen',
    'blocks': 'blokken',
    'min read': 'min lezen',
    'assessment passed': 'toets gehaald',
    'assessment available': 'toets beschikbaar',
    'assessment in draft': 'toets in concept',
    'Complete level': 'Level afronden',
    'Level complete': 'Level afgerond',
    'More levels are being written.': 'Er worden meer levels geschreven.',
    'In the meantime the prompt library and your projects are where the work continues.':
      'Ondertussen gaat het werk verder in de promptbibliotheek en je projecten.',
    'Assessment —': 'Toets —',
    'Project —': 'Project —',

    /* ------------------------------------------------------------- lesson */
    'Lesson': 'Les',
    'That lesson does not exist.': 'Die les bestaat niet.',
    'It may have been renamed. The course overview has everything that is published.':
      'Misschien is de naam veranderd. Het cursusoverzicht bevat alles wat gepubliceerd is.',
    'Back to the course': 'Terug naar de cursus',
    'Back to course': 'Terug naar de cursus',
    'This lesson is planned and its place in the course is fixed, but the content is still':
      'Deze les is gepland en heeft een vaste plek in de cursus, maar de inhoud wordt nog',
    'being written. It appears here the moment it is published.':
      'geschreven. Zodra hij gepubliceerd is, verschijnt hij hier.',
    'Progress is saved to your account,': 'Voortgang wordt bij je account bewaard,',
    'so you can pick this up on another device.':
      'zodat je hier op een ander apparaat verder kunt.',
    'move ·': 'navigeren ·',
    'complete ·': 'afronden ·',
    'save': 'opslaan',
    'Lesson complete?': 'Les afgerond?',
    'Mark as complete': 'Markeer als afgerond',
    'Completed ✓': 'Afgerond ✓',
    'Saved ✓': 'Opgeslagen ✓',
    'Lesson completed': 'Les afgerond',
    'Marked as not complete': 'Gemarkeerd als niet afgerond',
    'Saved to your dashboard': 'Opgeslagen op je dashboard',
    'Removed from saved': 'Verwijderd uit opgeslagen',
    'Video marked as watched': 'Video gemarkeerd als bekeken',
    'My notes': 'Mijn aantekeningen',
    'Saved': 'Opgeslagen',
    'Anything you want to remember from this lesson.':
      'Alles wat je uit deze les wilt onthouden.',
    'Private to you. Not visible to anyone else.':
      'Alleen voor jou. Niet zichtbaar voor anderen.',
    'Previous': 'Vorige',
    'Next lesson': 'Volgende les',

    /* --------------------------------------------------------- assessment */
    'Assessment': 'Toets',
    'Assessment /': 'Toets /',
    'Final assessment': 'Eindtoets',
    'Question': 'Vraag',
    'Select every answer that applies.': 'Selecteer elk antwoord dat klopt.',
    'Back': 'Terug',
    'Continue': 'Verder',
    'Submit assessment': 'Toets inleveren',
    'Next question': 'Volgende vraag',
    'Choose an answer to continue': 'Kies een antwoord om verder te gaan',
    'Review answers': 'Antwoorden nakijken',
    'Every one.': 'Allemaal goed.',
    'Strong understanding.': 'Sterk begrip.',
    'You passed this assessment. It is recorded against your account.':
      'Je bent geslaagd voor deze toets. Dat is bij je account vastgelegd.',
    'You need': 'Je hebt',
    '% to pass. The explanations below are the useful part —':
      '% nodig om te slagen. De uitleg hieronder is het nuttige deel —',
    'read them, then take it again.': 'lees die, en doe hem opnieuw.',
    '% to pass · your answers are graded on the server':
      '% om te slagen · je antwoorden worden op de server nagekeken',
    'The questions for this assessment are still being written. It unlocks the moment':
      'De vragen voor deze toets worden nog geschreven. Hij gaat open zodra hij',
    'it is published, and your progress in the level is unaffected.':
      'gepubliceerd is; je voortgang in het level verandert er niet door.',

    /* ------------------------------------------------------------ projects */
    'Projects': 'Projecten',
    'Build real things.': 'Bouw echte dingen.',
    'Open brief': 'Open briefing',
    'Brief': 'Briefing',
    'Client brief': 'Klantbriefing',
    'Goal.': 'Doel.',
    'Requirements': 'Eisen',
    'Recommended prompts': 'Aanbevolen prompts',
    'Checklist': 'Checklist',
    'Done': 'Klaar',
    'Final project': 'Eindproject',
    'Marked as delivered': 'Gemarkeerd als opgeleverd',
    'Mark as delivered': 'Markeer als opgeleverd',
    'Project marked as delivered': 'Project gemarkeerd als opgeleverd',
    'Four briefs. Each one uses everything from the':
      'Vier briefings. Elk gebruikt alles uit de',
    'levels before it, and each one ends with something you could show a client.':
      'levels ervoor, en elk eindigt met iets dat je aan een klant kunt laten zien.',

    /* ------------------------------------------------------------- prompts */
    'Copy prompt': 'Prompt kopiëren',
    'Copy': 'Kopiëren',
    'Copied': 'Gekopieerd',
    'Why this works': 'Waarom dit werkt',
    'open': 'open',
    'Resources': 'Bronnen',
    'Prompt /': 'Prompt /',
    'Every prompt in the course, with the reasoning':
      'Elke prompt uit de cursus, met de redenering',
    'behind it. Copy one, replace the placeholders, and read the explanation before you send it.':
      'erachter. Kopieer er een, vervang de plaatshouders en lees de uitleg voordat je hem verstuurt.',
    'Nothing matches “': 'Niets komt overeen met “',
    'paste into Claude and edit the placeholders':
      'plak in Claude en pas de plaatshouders aan',

    /* --------------------------------------------------------- certificate */
    'Certificate': 'Certificaat',
    'Course completed': 'Cursus afgerond',
    'Awarded to': 'Toegekend aan',
    'Issued': 'Uitgegeven',
    'Issued by': 'Uitgegeven door',
    'Keep going': 'Ga door',
    'KM.dev — this is a course': 'KM.dev — dit is een cursus',
    'completion certificate, not an external accreditation.':
      'certificaat, geen externe accreditatie.',
    'The certificate is issued once every published lesson is complete and the final':
      'Het certificaat wordt uitgegeven zodra elke gepubliceerde les af is en de eind',
    'assessment has been passed. Both are checked on the server, so it cannot be claimed early.':
      'toets gehaald is. Beide worden op de server gecontroleerd, dus je kunt hem niet te vroeg opeisen.',

    /* ------------------------------------------------------------ settings */
    'Your account.': 'Je account.',
    'Profile': 'Profiel',
    'Name': 'Naam',
    'Email': 'E-mail',
    'Save changes': 'Wijzigingen opslaan',
    'Session': 'Sessie',
    'Role': 'Rol',
    'Data': 'Gegevens',
    'Student': 'Student',
    'Changing an email address means re-verifying it, so it is':
      'Een e-mailadres wijzigen betekent het opnieuw verifiëren, dus dat wordt',
    'handled by the authentication provider rather than here.':
      'door de authenticatieprovider afgehandeld en niet hier.',
    'Preview mode keeps everything in this browser. Clearing it removes':
      'Voorbeeldmodus houdt alles in deze browser. Wissen verwijdert',
    'the accounts and all progress — useful when you want to walk the flow again from nothing.':
      'de accounts en alle voortgang — handig als je de flow opnieuw vanaf nul wilt doorlopen.',
    'Clear preview data': 'Voorbeeldgegevens wissen',

    /* -------------------------------------------------------------- search */
    '↑ ↓ move': '↑ ↓ navigeren',
    '↵ open': '↵ openen',
    'esc close': 'esc sluiten',

    /* --------------------------------------------------------------- admin */
    'Overview': 'Overzicht',
    'The course, in numbers.': 'De cursus, in cijfers.',
    'Lessons completed, last 14 days': 'Lessen afgerond, laatste 14 dagen',
    'No lessons completed in the last fourteen days.':
      'Geen lessen afgerond in de afgelopen veertien dagen.',
    'Content': 'Inhoud',
    'Users': 'Gebruikers',
    'No such user.': 'Die gebruiker bestaat niet.',
    'Completed lessons': 'Afgeronde lessen',
    'Last active': 'Laatst actief',
    'Open': 'Openen',
    'Add lesson': 'Les toevoegen',
    'Edit': 'Bewerken',
    'Delete': 'Verwijderen',
    'View': 'Bekijken',
    'Lesson editor': 'Leseditor',
    'Title': 'Titel',
    'Slug': 'Slug',
    'Description': 'Omschrijving',
    'Estimated minutes': 'Geschatte minuten',
    'Video URL': 'Video-URL',
    'Content blocks': 'Inhoudsblokken',
    'Save draft': 'Concept opslaan',
    'Save': 'Opslaan',
    'Preview': 'Voorbeeld',
    'Quizzes': 'Toetsen',
    'Questions': 'Vragen',
    'Pass mark': 'Slaaggrens',
    'Status': 'Status',
    'Quiz editor': 'Toetseditor',
    'Add question': 'Vraag toevoegen',
    'Briefs': 'Briefings',
    'Total students': 'Totaal studenten',
    'Active in 14 days': 'Actief in 14 dagen',
    'Average progress': 'Gemiddelde voortgang',
    'Assessment pass rate': 'Slaagpercentage toetsen',
    'Projects started': 'Projecten begonnen',
    'this lesson': 'deze les',
    'Lesson deleted': 'Les verwijderd',
    'Untitled lesson': 'Naamloze les',
    'Delete “': 'Verwijder “',
    '”? Progress recorded against it is removed too.':
      '”? De voortgang die eraan hangt wordt ook verwijderd.',
    'Order saved': 'Volgorde opgeslagen',
    'Interactive demo': 'Interactieve demo',
    'New heading': 'Nieuwe kop',
    'Unsaved changes': 'Niet-opgeslagen wijzigingen',
    'Leave without saving?': 'Weggaan zonder opslaan?',
    'Lesson saved': 'Les opgeslagen',
    'New question': 'Nieuwe vraag',
    'Option A': 'Optie A',
    'Option B': 'Optie B',
    'Mark at least one answer with a leading * as correct':
      'Markeer minstens één antwoord met een * ervoor als juist',
    'Question saved': 'Vraag opgeslagen',
    'Delete this question?': 'Deze vraag verwijderen?',
    'Course slug': 'Cursus-slug',
    'This area is for administrators.': 'Dit gedeelte is voor beheerders.',
    'Your account is a student account. The database refuses admin queries from it,':
      'Je account is een studentaccount. De database weigert beheerdersqueries daarvan,',
    'so there is nothing to see here even with the interface open.':
      'dus er valt hier niets te zien, ook niet met de interface open.',
    'Project briefs live in': 'Projectbriefings staan in',
    ', so they stay in version control alongside': ', zodat ze in versiebeheer blijven naast',
    'and are regenerated by': 'en worden opnieuw gegenereerd door',
    'the rest of the course.': 'de rest van de cursus.',
    'How this instance is wired': 'Hoe deze installatie is aangesloten',
    'Add your Supabase URL and anon key to': 'Zet je Supabase-URL en anon key in',
    ', run': ', draai',
    'and': 'en',
    ', and this switches to real accounts with server-side':
      ', en dit schakelt over naar echte accounts met server-side',
    'authorization. Nothing in the interface changes.':
      'autorisatie. Er verandert niets aan de interface.',
    'Authorization': 'Autorisatie',
    'Admin access is decided by the': 'Beheerderstoegang wordt bepaald door de',
    'column on': 'kolom op',
    'and enforced by row level security and SECURITY DEFINER':
      'en afgedwongen door row level security en SECURITY DEFINER',
    'functions. Hiding this section from a student is a convenience; the database is':
      'functies. Deze sectie voor een student verbergen is gemak; de database is',
    'what actually refuses them.': 'wat ze werkelijk weigert.',
    'New admins are created by adding their email to':
      'Nieuwe beheerders maak je door hun e-mailadres toe te voegen aan',
    'before they sign up, or by an existing admin changing':
      'voordat ze zich aanmelden, of door een bestaande beheerder die',
    'their role. No password ever appears in front-end code.':
      'hun rol wijzigt. Er staat nooit een wachtwoord in front-end code.',
    'No attempts yet.': 'Nog geen pogingen.',
    'Leave empty and the player shows an honest placeholder':
      'Laat leeg en de speler toont een eerlijke plaatshouder',
    'rather than pretending a video exists.':
      'in plaats van te doen alsof er een video is.',

    /* ------------------------------------------------- admin placeholders */
    'https://…': 'https://…',
    'file name': 'bestandsnaam',
    'prompt title': 'prompttitel',
    'title': 'titel',
    'task title': 'taaktitel',
    'image URL': 'afbeeldings-URL',
    'caption': 'onderschrift',
    'video URL': 'video-URL',
    'question': 'vraag',
    'one option per line': 'één optie per regel',
    'index of correct answers, e.g. 1': 'index van juiste antwoorden, bijv. 1',
    'explanation': 'uitleg',
    'one answer per line, prefix correct ones with *':
      'één antwoord per regel, zet een * voor de juiste',
    'explanation shown after answering': 'uitleg die na het antwoorden verschijnt',
    'Move up': 'Omhoog',
    'Move down': 'Omlaag',
    'Remove': 'Verwijderen',

    /* ------------------------------------------------- blocks: chrome/demos */
    'Build': 'Bouw',
    'Test': 'Test',
    'Try it': 'Probeer het',
    'In short': 'Kort samengevat',
    'Image slot': 'Afbeeldingsplek',
    'A screenshot belongs here.': 'Hier hoort een schermafbeelding.',
    'Add the file in the lesson editor and it appears in place of this panel.':
      'Voeg het bestand toe in de leseditor en het verschijnt op de plek van dit paneel.',
    'Lesson video': 'Lesvideo',
    'Video completed': 'Video afgerond',
    'The player is wired up and tracks progress. Paste a video URL in the lesson editor':
      'De speler is aangesloten en houdt voortgang bij. Plak een video-URL in de leseditor',
    'and it plays here — nothing is invented in the meantime.':
      'en hij speelt hier — er wordt ondertussen niets verzonnen.',
    'Play': 'Afspelen',
    'Seek': 'Zoeken',
    'Image viewer': 'Afbeeldingsweergave',
    'Zoom in': 'Inzoomen',
    'Zoom out': 'Uitzoomen',
    'Close': 'Sluiten',
    'Next': 'Volgende',
    'Card': 'Kaart',
    'Restart': 'Opnieuw',
    'Next message': 'Volgend bericht',
    'Weak': 'Zwak',
    'Strong': 'Sterk',
    'Show every change': 'Toon elke wijziging',
    'possible answers': 'mogelijke antwoorden',
    'Headline size': 'Kopgrootte',
    'Space': 'Ruimte',
    'Radius': 'Radius',
    'Accent': 'Accent',
    'See the work': 'Bekijk het werk',
    'Their browser': 'Hun browser',
    'Your server': 'Jouw server',
    'their browser': 'hun browser',
    'your server': 'jouw server',
    'their computer': 'hun computer',
    'your computer': 'jouw computer',
    'Front end': 'Front-end',
    'Back end': 'Back-end',
    'In the conversation': 'In het gesprek',
    'Click a line with a value to change it.': 'Klik op een regel met een waarde om die te wijzigen.',
    'Four numbers. Same content. Move one at a time and watch what each is worth.':
      'Vier getallen. Dezelfde inhoud. Verander er één tegelijk en kijk wat elk waard is.',
    'You asked for the padding only. Read the diff before you accept it.':
      'Je vroeg alleen om de padding. Lees de diff voordat je hem accepteert.',
    'No constraints: the model returns the average of everything it has seen.':
      'Geen constraints: het model geeft het gemiddelde terug van alles wat het gezien heeft.',
    'Narrower. Still room for a result you would not ship.':
      'Smaller. Nog steeds ruimte voor een resultaat dat je niet zou opleveren.',
    'Now what remains is your work rather than everyone’s.':
      'Wat overblijft is nu jouw werk in plaats van dat van iedereen.',
    'Which ambiguity costs you more?': 'Welke dubbelzinnigheid kost je meer?',
    'Yes — that is the one that quietly changes the result.':
      'Ja — dat is degene die het resultaat stilletjes verandert.',
    'That one matters, but the other is the expensive one.':
      'Die telt mee, maar de andere is de dure.',
    'Every instruction leaves something open. The habit is to find it before you send.':
      'Elke instructie laat iets open. De gewoonte is om dat te vinden voordat je verstuurt.',
    'Every one. The boundary is about trust, not difficulty.':
      'Allemaal. De grens gaat over vertrouwen, niet over moeilijkheid.',
    'Anything that must be true regardless of what the browser claims belongs on the server.':
      'Alles wat waar moet zijn ongeacht wat de browser beweert, hoort op de server.',
    'It belongs on': 'Het hoort op',
    'Two lines changed, not one. The display switch was never requested — that is how a layout quietly moves.':
      'Twee regels veranderd, niet één. Om de display-omschakeling is nooit gevraagd — zo verschuift een layout ongemerkt.',
    'Space is a decision. One value changes how the whole thing breathes.':
      'Ruimte is een beslissing. Eén waarde verandert hoe het geheel ademt.',
    'Radius sets the tone: sharp reads technical, round reads friendly.':
      'De radius zet de toon: scherp leest technisch, rond leest vriendelijk.',
    'change one without breaking the other two':
      'verander er één zonder de andere twee te breken',
    'if it is not on the left, it does not exist':
      'staat het niet links, dan bestaat het niet',
    'the highlighted five happen before any code exists':
      'de vijf gemarkeerde gebeuren voordat er code bestaat',
    'space of answers the model could reasonably give':
      'ruimte aan antwoorden die het model redelijkerwijs kan geven',
    'structure and meaning': 'structuur en betekenis',
    'what things are': 'wat dingen zijn',
    'appearance': 'uiterlijk',
    'how they look': 'hoe ze eruitzien',
    'behaviour': 'gedrag',
    'what they do': 'wat ze doen',
    'layout · type · interaction': 'layout · typografie · interactie',
    'readable · editable · not trusted': 'leesbaar · aanpasbaar · niet vertrouwd',
    'accounts · permissions · data': 'accounts · rechten · gegevens',
    'the only place a rule is real': 'de enige plek waar een regel echt is',
    'your messages · pasted code · its own replies':
      'je berichten · geplakte code · zijn eigen antwoorden',
    'your files · yesterday · your screen · your client':
      'je bestanden · gisteren · je scherm · je klant',
    'what it must do': 'wat het moet doen',
    'who and what for': 'voor wie en waarvoor',
    'what is ruled out': 'wat is uitgesloten',
    'decisions already made': 'beslissingen die al genomen zijn',
    'how much you want back': 'hoeveel je terug wilt',
    'files, language, format': 'bestanden, taal, formaat',
    'no constraints': 'geen constraints',
    '+ audience named': '+ doelgroep benoemd',
    '+ technical rules': '+ technische regels',
    '+ visual direction': '+ visuele richting',
    '+ exclusions': '+ uitsluitingen',
    'families · scale · tracking': 'families · schaal · tracking',
    'unit · rhythm · air': 'eenheid · ritme · lucht',
    'count · roles · frequency': 'aantal · rollen · frequentie',
    'grid · alignment · balance': 'grid · uitlijning · balans',
    'what moves · how far · how fast': 'wat beweegt · hoe ver · hoe snel',
    'Remembering syntax': 'Syntaxis onthouden',
    'Typing the first draft': 'De eerste versie typen',
    'Deciding what to build': 'Beslissen wat je bouwt',
    'Reading and judging output': 'Output lezen en beoordelen',
    'You type an address': 'Je typt een adres',
    'Browser sends a request': 'Browser stuurt een verzoek',
    'Server answers with index.html': 'Server antwoordt met index.html',
    'Browser asks for css and js': 'Browser vraagt om css en js',
    'Browser paints the page': 'Browser tekent de pagina',
    'Deciding whether a password is correct': 'Bepalen of een wachtwoord klopt',
    'Animating a menu open': 'Een menu openend animeren',
    'Deciding who may delete a user': 'Bepalen wie een gebruiker mag verwijderen',
    'Showing a friendly error under a field': 'Een vriendelijke fout onder een veld tonen',
    'Storing an order': 'Een bestelling opslaan',
    'Remembering which tab was open': 'Onthouden welk tabblad open stond',
    'Act as': 'Treed op als',
    'Build a website': 'Bouw een website',
    'a senior front-end developer': 'een senior front-end developer',
    'Front-end dev': 'Front-end dev',
    'a design engineer': 'een design engineer',
    'Design engineer': 'Design engineer',
    'build a landing page that books calls':
      'bouw een landingspagina die gesprekken boekt',
    'Book calls': 'Gesprekken boeken',
    'build a portfolio that gets replies':
      'bouw een portfolio dat antwoorden oplevert',
    'for a two-person architecture studio': 'voor een architectenbureau van twee',
    'Architecture studio': 'Architectenbureau',
    'for a solo photographer': 'voor een zelfstandige fotograaf',
    'in a restrained editorial style with oversized headlines':
      'in een ingetogen redactionele stijl met overmaatse koppen',
    'technical and monospace-led': 'technisch en monospace-gedreven',
    'on a 12-column grid with asymmetric rows':
      'op een grid van 12 kolommen met asymmetrische rijen',
    'as one centred column with wide margins':
      'als één gecentreerde kolom met brede marges',
    'Single column': 'Eén kolom',
    'with one call to action and a contact form':
      'met één call to action en een contactformulier',
    'CTA + form': 'CTA + formulier',
    'with a filterable project list': 'met een filterbare projectlijst',
    'No libraries, no stock imagery, readable from 360px.':
      'Geen libraries, geen stockbeelden, leesbaar vanaf 360px.',
    'No libs, no stock': 'Geen libs, geen stock',
    'Semantic HTML, keyboard accessible, AA contrast.':
      'Semantische HTML, met toetsenbord bedienbaar, AA-contrast.',
    'Plain HTML, CSS and JavaScript in three files.':
      'Kale HTML, CSS en JavaScript in drie bestanden.',
    'Plain HTML, CSS and JS': 'Kale HTML, CSS en JS',
    'Three files': 'Drie bestanden',
    'One HTML file with inline CSS and JS.':
      'Eén HTML-bestand met inline CSS en JS.',
    'Single file': 'Eén bestand',
    'Return the code, then list three decisions I might disagree with.':
      'Geef de code, en noem daarna drie beslissingen waar ik het misschien niet mee eens ben.',
    'Code + decisions': 'Code + beslissingen',
    'Return a plan first, no code yet.': 'Geef eerst een plan, nog geen code.',
    'Plan first': 'Eerst een plan',
    'Readable from 360px': 'Leesbaar vanaf 360px',
    'No stock imagery': 'Geen stockbeelden',
    'One accent colour': 'Eén accentkleur',
    'No cards or carousels': 'Geen kaarten of carousels',
    'Build me a hero section.': 'Bouw een hero-sectie voor me.',
    'A centred headline, a grey subtitle and a blue button. Technically fine. Could belong to any company on earth.':
      'Een gecentreerde kop, een grijze subtitel en een blauwe knop. Technisch prima. Zou van elk bedrijf ter wereld kunnen zijn.',
    'Build a hero for a design studio. Make it modern and clean.':
      'Bouw een hero voor een designstudio. Maak het modern en clean.',
    'Larger type, more whitespace, still a card and still a gradient. Better looking, same absence of a point of view.':
      'Grotere letters, meer whitespace, nog steeds een kaart en nog steeds een gradient. Mooier, met hetzelfde gebrek aan standpunt.',
    'Build a hero for a two-person studio whose visitors are art directors comparing three shortlists. One action: view the work. Oversized headline set tight, one accent colour, asymmetric, no card, no gradient, readable at 360px.':
      'Bouw een hero voor een studio van twee wiens bezoekers art directors zijn die drie shortlists vergelijken. Eén actie: het werk bekijken. Overmaatse kop strak gezet, één accentkleur, asymmetrisch, geen kaart, geen gradient, leesbaar op 360px.',
    'An asymmetric composition with a headline that carries the message, one accent, and a single link. Something you would argue about rather than ignore.':
      'Een asymmetrische compositie met een kop die de boodschap draagt, één accent en één link. Iets waarover je discussieert in plaats van het te negeren.',
    'I want to build a premium portfolio site for a two-person studio. Before any code, propose a structure and tell me why.':
      'Ik wil een premium portfoliosite bouwen voor een studio van twee. Stel vóór enige code een structuur voor en vertel me waarom.',
    'Five sections: a hero that states what you do, three project rows, a short about, and one contact block. The project rows carry the weight — for a studio, the work is the argument.':
      'Vijf secties: een hero die zegt wat je doet, drie projectrijen, een kort over-blok en één contactblok. De projectrijen dragen het gewicht — voor een studio is het werk het argument.',
    'Agreed. Build the hero only. Oversized headline, one accent, no card, no gradient. Readable at 360px.':
      'Akkoord. Bouw alleen de hero. Overmaatse kop, één accent, geen kaart, geen gradient. Leesbaar op 360px.',
    'Here is the hero. I set the headline in clamp() so it scales without a media query, and kept the supporting line to 14 words.':
      'Hier is de hero. Ik heb de kop in clamp() gezet zodat hij schaalt zonder media query, en de ondersteunende regel op 14 woorden gehouden.',
    'At 380px the headline overlaps the nav.': 'Op 380px overlapt de kop de nav.',
    'The hero has a fixed 120px top padding but the nav is 76px and wraps to two lines below 420px. Changing the padding to a variable tied to the nav height fixes it at every width.':
      'De hero heeft een vaste top padding van 120px, maar de nav is 76px en breekt onder 420px naar twee regels. De padding vervangen door een variabele die aan de nav-hoogte hangt, lost het op elke breedte op.',
    'Do that. Change nothing else.': 'Doe dat. Verander verder niets.',
    'Two lines changed. The nav height is now a custom property and the hero padding is calculated from it.':
      'Twee regels veranderd. De nav-hoogte is nu een custom property en de hero-padding wordt daaruit berekend.',
    'Make the page layout better.': 'Maak de paginalayout beter.',
    'Above 900px put the image and text side by side at 5:7 with 48px between. Keep the stacked order below.':
      'Zet boven 900px de afbeelding en tekst naast elkaar op 5:7 met 48px ertussen. Houd daaronder de gestapelde volgorde aan.',
    'The menu is broken.': 'Het menu is stuk.',
    'Below 768px the menu opens on tap but will not close on a second tap. No console errors. Started after the scroll listener on line 40.':
      'Onder 768px opent het menu bij een tik maar sluit het niet bij een tweede tik. Geen fouten in de console. Begon na de scroll listener op regel 40.',
    'Make it feel premium.': 'Laat het premium aanvoelen.',
    'One accent used at most twice per screen, headline tracking -0.03em, no shadows, hairline borders, 96px between sections.':
      'Eén accent, hooguit twee keer per scherm, kop-tracking -0.03em, geen schaduwen, haarlijnranden, 96px tussen secties.',
    'Clean up this code.': 'Ruim deze code op.',
    'The card markup repeats four times. Extract one function taking title, body and href. Do not change the rendered HTML or class names.':
      'De kaart-markup herhaalt zich vier keer. Haal er één functie uit die title, body en href aanneemt. Verander de gerenderde HTML en de classnamen niet.',
    'Give me some options.': 'Geef me een paar opties.',
    'Three hero variations differing only in composition: centred, left with image right, full-bleed overlay. Same copy and tokens.':
      'Drie hero-varianten die alleen in compositie verschillen: gecentreerd, links met afbeelding rechts, full-bleed overlay. Dezelfde tekst en tokens.',
    'Is this good?': 'Is dit goed?',
    'Review for spacing against the 8px scale, type scale adherence, contrast and keyboard operability. Findings worst-first, no fixes yet.':
      'Beoordeel de spacing tegen de 8px-schaal, het volgen van de typeschaal, contrast en bedienbaarheid met toetsenbord. Bevindingen slechtste eerst, nog geen oplossingen.',
    'Fix the header.': 'Repareer de header.',
    'Only the header, or the navigation inside it too?':
      'Alleen de header, of ook de navigatie erin?',
    'Fix what, exactly — what is wrong with it?':
      'Repareer wat precies — wat is er mis mee?',
    'Make it responsive.': 'Maak het responsive.',
    'Down to what width, and on which device?':
      'Tot welke breedte, en op welk apparaat?',
    'Should it use a framework?': 'Moet het een framework gebruiken?',
    'Change the button colour to green.': 'Verander de knopkleur naar groen.',
    'Which green?': 'Welk groen?',
    'Should hover, focus and disabled change too?':
      'Moeten hover, focus en disabled ook veranderen?',
    'Studio Vanhorn': 'Studio Vanhorn',

    /* ------------------------------------------------- chrome and figures */
    'Skip to content': 'Naar de inhoud',
    'Language': 'Taal',
    'Locked': 'Op slot',
    'Project': 'Project',
    'Final': 'Eind',
    'All': 'Alles',
    'Where you are.': 'Waar je staat.',
    'Assessments': 'Toetsen',
    'draft': 'concept',
    'Setup': 'Installatie',
    'Prompts': 'Prompts',
    'Course management': 'Cursusbeheer',
    'Student view': 'Studentweergave',
    'Debugging': 'Debuggen',
    'Layout': 'Layout',
    'Bug': 'Bug',
    'Style': 'Stijl',
    'Options': 'Opties',
    'Review': 'Review',
    'context': 'context',
    'constraints': 'constraints',
    'output': 'output',
    'iteration': 'iteratie',
    'None context': 'Geen context',
    'Some context': 'Wat context',
    'Full context': 'Volledige context',
    'Learn \u00b7 Build \u00b7 Understand \u00b7 Iterate \u00b7 Ship':
      'Leren \u00b7 Bouwen \u00b7 Begrijpen \u00b7 Itereren \u00b7 Opleveren',
    'Back to km.dev': 'Terug naar km.dev',
    '\u25a0 before \u00a0\u00a0 \u25a0 with AI assistance':
      '\u25a0 ervoor \u00a0\u00a0 \u25a0 met AI-hulp',

    /* Sentences the browser joins into one text node. */
    'No Supabase project is connected, so accounts and progress live in this browser only. Nothing here is a real account.':
      'Er is geen Supabase-project gekoppeld, dus accounts en voortgang staan alleen in deze browser. Niets hier is een echt account.',
    'Progress is saved to your account, so you can pick this up on another device.':
      'Voortgang wordt bij je account bewaard, zodat je hier op een ander apparaat verder kunt.',
    'This lesson is planned and its place in the course is fixed, but the content is still being written. It appears here the moment it is published.':
      'Deze les is gepland en heeft een vaste plek in de cursus, maar de inhoud wordt nog geschreven. Zodra hij gepubliceerd is, verschijnt hij hier.',
    'The questions for this assessment are still being written. It unlocks the moment it is published, and your progress in the level is unaffected.':
      'De vragen voor deze toets worden nog geschreven. Hij gaat open zodra hij gepubliceerd is; je voortgang in het level verandert er niet door.',
    'Four briefs. Each one uses everything from the levels before it, and each one ends with something you could show a client.':
      'Vier briefings. Elk gebruikt alles uit de levels ervoor, en elk eindigt met iets dat je aan een klant kunt laten zien.',
    'Every prompt in the course, with the reasoning behind it. Copy one, replace the placeholders, and read the explanation before you send it.':
      'Elke prompt uit de cursus, met de redenering erachter. Kopieer er een, vervang de plaatshouders en lees de uitleg voordat je hem verstuurt.',
    'The certificate is issued once every published lesson is complete and the final assessment has been passed. Both are checked on the server, so it cannot be claimed early.':
      'Het certificaat wordt uitgegeven zodra elke gepubliceerde les af is en de eindtoets gehaald is. Beide worden op de server gecontroleerd, dus je kunt hem niet te vroeg opeisen.',
    'Changing an email address means re-verifying it, so it is handled by the authentication provider rather than here.':
      'Een e-mailadres wijzigen betekent het opnieuw verifi\u00ebren, dus dat wordt door de authenticatieprovider afgehandeld en niet hier.',
    'Preview mode keeps everything in this browser. Clearing it removes the accounts and all progress \u2014 useful when you want to walk the flow again from nothing.':
      'Voorbeeldmodus houdt alles in deze browser. Wissen verwijdert de accounts en alle voortgang \u2014 handig als je de flow opnieuw vanaf nul wilt doorlopen.',
    'More levels are being written. In the meantime the prompt library and your projects are where the work continues.':
      'Er worden meer levels geschreven. Ondertussen gaat het werk verder in de promptbibliotheek en je projecten.',
    'Your account is a student account. The database refuses admin queries from it, so there is nothing to see here even with the interface open.':
      'Je account is een studentaccount. De database weigert beheerdersqueries daarvan, dus er valt hier niets te zien, ook niet met de interface open.',
    'Leave empty and the player shows an honest placeholder rather than pretending a video exists.':
      'Laat leeg en de speler toont een eerlijke plaatshouder in plaats van te doen alsof er een video is.',
    'The player is wired up and tracks progress. Paste a video URL in the lesson editor and it plays here \u2014 nothing is invented in the meantime.':
      'De speler is aangesloten en houdt voortgang bij. Plak een video-URL in de leseditor en hij speelt hier \u2014 er wordt ondertussen niets verzonnen.',
    'A screenshot belongs here. Add the file in the lesson editor and it appears in place of this panel.':
      'Hier hoort een schermafbeelding. Voeg het bestand toe in de leseditor en het verschijnt op de plek van dit paneel.',
    'Nothing completed yet. The first lesson takes about ten minutes. All progress':
      'Nog niets afgerond. De eerste les kost ongeveer tien minuten. Alle voortgang'

  };

  /* Phrases the interface builds around a number or a title. Applied in order
     when no exact key matches; the first hit wins. */
  var PATTERNS = [
    [/^(\d+) min read$/,                          '$1 min lezen'],
    [/^Lesson (\d+)$/,                            'Les $1'],
    [/^Lesson (\d+) of (\d+)$/,                   'Les $1 van $2'],
    [/^Level (\d+) \/ Lesson (\d+)$/,             'Level $1 / Les $2'],
    [/^Question (\d+) \/ (\d+)$/,                 'Vraag $1 / $2'],
    [/^Assessment \/ (.+)$/,                      'Toets / $1'],
    [/^Assessment \u2014 (.+)$/,                   'Toets \u2014 $1'],
    [/^Project \u2014 (.+)$/,                      'Project \u2014 $1'],
    [/^Complete level (\d+)$/,                    'Rond level $1 af'],
    [/^Good to see you, (.+)\.$/,                 'Fijn je te zien, $1.'],
    [/^(\d+) \/ (\d+) lessons completed$/,        '$1 / $2 lessen afgerond'],
    [/^(\d+) \/ (\d+) levels completed$/,         '$1 / $2 levels afgerond'],
    [/^(\d+) \/ (\d+) published \u00b7 (\d+) planned$/,
      '$1 / $2 gepubliceerd \u00b7 $3 gepland'],
    [/^(\d+) projects? started$/,                 '$1 projecten begonnen'],
    [/^(\d+) total$/,                             '$1 totaal'],
    [/^(\d+) blocks$/,                            '$1 blokken'],
    [/^(\d+) saved$/,                             '$1 opgeslagen'],
    [/^(\d+) levels \u00b7 (\d+) lessons \u00b7 (\d+) projects \u00b7 (\d+) assessments \u00b7 (\d+) published so far$/,
      '$1 levels \u00b7 $2 lessen \u00b7 $3 projecten \u00b7 $4 toetsen \u00b7 $5 tot nu toe gepubliceerd'],
    [/^(\d+) questions \u00b7 (\d+)% to pass \u00b7 your answers are graded on the server$/,
      '$1 vragen \u00b7 $2% om te slagen \u00b7 je antwoorden worden op de server nagekeken'],
    [/^You need (\d+)% to pass\.(.*)$/,           'Je hebt $1% nodig om te slagen.$2'],
    [/^(\d+) questions$/,                         '$1 vragen'],
    [/^(\d+) lessons$/,                           '$1 lessen'],
    [/^(\d+) levels$/,                            '$1 levels']
  ];

  function byPattern(s) {
    for (var i = 0; i < PATTERNS.length; i++) {
      if (PATTERNS[i][0].test(s)) return s.replace(PATTERNS[i][0], PATTERNS[i][1]);
    }
    return null;
  }


  /* -------------------------------------------------------------- engine */

  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TEXTAREA: 1 };
  /* Code, terminals and prompt bodies are content, not interface. Their text
     is either source or a sentence the student is meant to paste — both would
     be damaged by translation, and both already arrive in the right language
     from the course database. */
  var SKIP_CLASS = /(^|\s)(blk-code|editor|code-line|term|prompt-c__body|diff|no-i18n)(\s|$)/;

  function skipped(el) {
    return SKIP[el.tagName] ||
           (typeof el.className === 'string' && SKIP_CLASS.test(el.className));
  }

  var originals = new WeakMap();   /* node → the English it was rendered with */
  var attrOriginals = new WeakMap();
  var observer = null;
  var busy = false;

  function lang() {
    try {
      if (window.KM && KM.currentLang) return KM.currentLang();
      return localStorage.getItem('km-lang') || 'en';
    } catch (e) { return 'en'; }
  }

  /* Translate a text node in place, remembering what was there before so the
     English can be put back without a reload. */
  function doText(node, toNL) {
    var cur = node.nodeValue;
    if (toNL) {
      var key = cur.trim();
      if (!key) return;
      var nl = DICT[key] || byPattern(key);
      if (!nl || nl === key) return;
      if (originals.has(node) && originals.get(node) === cur) return;
      originals.set(node, cur);
      node.nodeValue = cur.replace(key, nl);
    } else if (originals.has(node)) {
      node.nodeValue = originals.get(node);
      originals.delete(node);
    }
  }

  function doAttrs(el, toNL) {
    for (var i = 0; i < ATTRS.length; i++) {
      var name = ATTRS[i];
      if (!el.hasAttribute || !el.hasAttribute(name)) continue;
      /* Markup that carries its own data-en / data-nl pair is core.js's. */
      if (el.hasAttribute('data-nl-aria') && name === 'aria-label') continue;
      var cur = el.getAttribute(name);
      var store = attrOriginals.get(el) || {};
      if (toNL) {
        var nl = DICT[cur.trim()] || byPattern(cur.trim());
        if (!nl || nl === cur.trim()) continue;
        if (store[name] === undefined) { store[name] = cur; attrOriginals.set(el, store); }
        el.setAttribute(name, nl);
      } else if (store[name] !== undefined) {
        el.setAttribute(name, store[name]);
        delete store[name];
      }
    }
  }

  function walk(root, toNL) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root, toNL); return; }
    if (root.nodeType !== 1) return;
    if (skipped(root)) return;
    doAttrs(root, toNL);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) {
        if (n.nodeType === 1) return skipped(n) ? NodeFilter.FILTER_REJECT
                                                : NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) doText(n, toNL);
      else doAttrs(n, toNL);
    }
  }

  function apply(root) {
    if (busy) return;
    busy = true;
    try { walk(root || document.body, lang() === 'nl'); }
    finally { busy = false; }
  }

  /* The academy renders asynchronously and re-renders in place, so rather than
     asking every controller to call back, watch the document. */
  function observe() {
    if (observer || !window.MutationObserver) return;
    observer = new MutationObserver(function (records) {
      if (busy || lang() !== 'nl') return;
      busy = true;
      try {
        for (var i = 0; i < records.length; i++) {
          var r = records[i];
          if (r.type === 'characterData') { doText(r.target, true); continue; }
          for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j], true);
          if (r.type === 'attributes' && r.target.nodeType === 1) doAttrs(r.target, true);
        }
      } finally { busy = false; }
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  function start() {
    apply();
    observe();
    document.addEventListener('km:lang', function () { apply(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  return {
    dict: DICT,
    patterns: PATTERNS,
    /* Language-independent lookup, used by build/i18n-scan.js. */
    lookup: function (s) { return DICT[s] || byPattern(s) || null; },
    lang: lang,
    t: function (s) { return (lang() === 'nl' && (DICT[s] || byPattern(s))) || s; },
    apply: apply
  };
})();
