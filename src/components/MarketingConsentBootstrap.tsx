import {
  MARKETING_CONSENT_KEY,
  MARKETING_CONSENT_MAX_AGE_MS,
  MARKETING_CONSENT_VERSION,
} from '@/lib/marketing-consent'

const bootstrapScript = `!function(){
  var state='missing';
  try {
    var raw=window.localStorage.getItem(${JSON.stringify(MARKETING_CONSENT_KEY)});
    var value=raw?JSON.parse(raw):null;
    var now=Date.now();
    var valid=value&&
      (value.choice==='granted'||value.choice==='denied')&&
      value.version===${MARKETING_CONSENT_VERSION}&&
      typeof value.decidedAt==='number'&&
      Number.isFinite(value.decidedAt)&&
      value.decidedAt<=now&&
      (typeof value.userId==='string'||now-value.decidedAt<=${MARKETING_CONSENT_MAX_AGE_MS});
    if(valid) state='stored';
  } catch (_) {}
  document.documentElement.dataset.reskiMarketingConsent=state;
}();`

export default function MarketingConsentBootstrap() {
  return (
    <>
      <script
        id="marketing-consent-bootstrap"
        dangerouslySetInnerHTML={{ __html: bootstrapScript }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `html[data-reski-marketing-consent="stored"] #marketing-consent-overlay[data-bootstrap-pending="true"]{display:none}`,
        }}
      />
    </>
  )
}
