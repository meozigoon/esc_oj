const origin =
    import.meta.env.VITE_PUBLIC_ORIGIN ??
    (typeof window !== "undefined" ? window.location.origin : "");
const benefitUrl = origin ? `${origin}/benefit` : "/benefit";

export const devtoolsBanner = [
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "░████████╗░███████╗░███████╗░",
    "░██╔═════╝██╔═════╝██╔═════╝░",
    "░██████╗░░╚██████╗░██║░░░░░░░",
    "░██╔═══╝░░░╚════██╗██║░░░░░░░",
    "░████████╗███████╔╝╚███████╗░",
    "░╚═══════╝╚══════╝░░╚══════╝░",
    "░░░░░░░░░░░░░░░░░░░░░░░░░░░░░",
    "\n베네핏을 찾았습니다!",
    "로그인 후 링크를 클릭하세요: " + benefitUrl,
].join("\n");
