

import Logo from "/src/assets/images/logos/logo.png";
import { Link } from "react-router-dom";
const FullLogo = () => {
  return (
    <Link to={"/"} className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
      <img src={Logo} style={{width: '50px'}} alt="logo" className="block me-3" />
      HN-CheckXML
    </Link>
  );
};

export default FullLogo;
